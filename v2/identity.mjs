import {createPublicKey, sign, verify, randomUUID, randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {existsSync, lstatSync, chmodSync} from 'node:fs';

function publicKey(pem) {
  if (typeof pem !== 'string' || pem.length > 1024 || !pem.startsWith('-----BEGIN PUBLIC KEY-----')) throw Error('Invalid public key');
  const key = createPublicKey(pem);
  if (key.asymmetricKeyType !== 'ed25519') throw Error('Ed25519 required');
  return key;
}
function payload(binding) {
  if (!binding || Object.keys(binding).sort().join(',') !== 'expiresAt,id,issuedAt,issuer,name,signature,subject') throw Error('Invalid binding fields');
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(binding.name) || typeof binding.name !== 'string') throw Error('Invalid name');
  if (typeof binding.id !== 'string' || !/^[a-f0-9-]{36}$/.test(binding.id)) throw Error('Invalid ID');
  publicKey(binding.subject); publicKey(binding.issuer);
  if (!Number.isSafeInteger(binding.issuedAt) || !Number.isSafeInteger(binding.expiresAt) || binding.expiresAt <= binding.issuedAt || binding.expiresAt-binding.issuedAt > 86400000) throw Error('Invalid lifetime');
  return Buffer.from(JSON.stringify(['ans-v2', binding.id, binding.name, binding.subject, binding.issuer, binding.issuedAt, binding.expiresAt]));
}
export function issue({name, subject, issuerPrivateKey, now=Date.now(), ttl=3600000}) {
  const issuer=createPublicKey(issuerPrivateKey).export({type:'spki',format:'pem'}).toString();
  const binding={id:randomUUID(),name,subject,issuer,issuedAt:now,expiresAt:now+ttl,signature:''};
  binding.signature=sign(null,payload(binding),issuerPrivateKey).toString('base64');
  return binding;
}
export function verifyBinding(binding, trustedIssuer, now=Date.now()) {
  try {
    const data=payload(binding);
    if (binding.issuer!==trustedIssuer || binding.issuedAt>now || binding.expiresAt<=now || typeof binding.signature!=='string' || !/^[A-Za-z0-9+/]{86}==$/.test(binding.signature)) return false;
    return verify(null,data,publicKey(trustedIssuer),Buffer.from(binding.signature,'base64'));
  } catch { return false; }
}
export function challengePayload(bindingId, nonce, audience) {
  if (typeof bindingId!=='string' || typeof nonce!=='string' || !/^[a-f0-9]{64}$/.test(nonce) || typeof audience!=='string' || audience.length<1 || audience.length>256) throw Error('Invalid challenge');
  return Buffer.from(JSON.stringify(['ans-proof-v2',bindingId,nonce,audience]));
}
export function verifyProof(binding, trustedIssuer, {nonce,audience,signature}, now=Date.now()) {
  try { return verifyBinding(binding,trustedIssuer,now) && typeof signature==='string' && signature.length===88 && verify(null,challengePayload(binding.id,nonce,audience),publicKey(binding.subject),Buffer.from(signature,'base64')); } catch { return false; }
}
export class Registry {
  constructor(path, trustedIssuer, capacity=10000) {
    publicKey(trustedIssuer);
    if (!Number.isSafeInteger(capacity)||capacity<1||capacity>1000000) throw Error('Invalid capacity');
    if (path!==':memory:' && existsSync(path) && (!lstatSync(path).isFile()||lstatSync(path).isSymbolicLink())) throw Error('Invalid database file');
    this.db=new DatabaseSync(path);this.issuer=trustedIssuer;this.capacity=capacity;
    if (path!==':memory:') chmodSync(path,0o600);
    this.db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS bindings(id TEXT PRIMARY KEY,name TEXT UNIQUE NOT NULL,body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS revoked(id TEXT PRIMARY KEY); CREATE TABLE IF NOT EXISTS challenges(nonce TEXT PRIMARY KEY,audience TEXT NOT NULL,expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS consumed(nonce TEXT PRIMARY KEY,expires INTEGER NOT NULL);');
  }
  register(binding, now=Date.now()) {
    if (!verifyBinding(binding,this.issuer,now)) throw Error('Invalid binding');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (this.db.prepare('SELECT 1 FROM revoked WHERE id=?').get(binding.id)) throw Error('Revoked binding');
      if (this.db.prepare('SELECT count(*) AS n FROM bindings').get().n>=this.capacity) throw Error('Registry capacity');
      this.db.prepare('INSERT INTO bindings VALUES(?,?,?)').run(binding.id,binding.name,JSON.stringify(binding));
      this.db.exec('COMMIT');
    } catch(e) {this.db.exec('ROLLBACK');throw e;}
  }
  resolve(name, now=Date.now()) {
    const row=this.db.prepare('SELECT body FROM bindings WHERE name=? AND id NOT IN (SELECT id FROM revoked)').get(name);
    if (!row) return null;
    const b=JSON.parse(row.body);return verifyBinding(b,this.issuer,now)?b:null;
  }
  revoke(id) {
    this.db.exec('BEGIN IMMEDIATE');
    try {this.db.prepare('INSERT OR IGNORE INTO revoked VALUES(?)').run(id);this.db.prepare('DELETE FROM bindings WHERE id=?').run(id);this.db.exec('COMMIT');}
    catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  challenge(audience, now=Date.now()) {
    const nonce=randomBytes(32).toString('hex');challengePayload('challenge',nonce,audience);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('DELETE FROM challenges WHERE expires<=?').run(now);
      if(this.db.prepare('SELECT count(*) AS n FROM challenges').get().n>=10000) throw Error('Challenge capacity');
      this.db.prepare('INSERT INTO challenges VALUES(?,?,?)').run(nonce,audience,now+60000);
      this.db.exec('COMMIT');return {nonce,audience};
    } catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  authenticate(name, proof, expectedAudience, now=Date.now()) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const challenge=this.db.prepare('SELECT audience,expires FROM challenges WHERE nonce=?').get(proof.nonce);
      if(!challenge||challenge.expires<=now||challenge.audience!==expectedAudience||proof.audience!==expectedAudience) throw Error('Unknown challenge');
      const b=this.resolve(name,now);
      if(!b||!verifyProof(b,this.issuer,proof,now)) throw Error('Invalid proof');
      this.db.prepare('DELETE FROM consumed WHERE expires<=?').run(now);
      if(this.db.prepare('SELECT count(*) AS n FROM consumed').get().n>=100000) throw Error('Replay capacity');
      this.db.prepare('INSERT INTO consumed VALUES(?,?)').run(proof.nonce,b.expiresAt);
      this.db.prepare('DELETE FROM challenges WHERE nonce=?').run(proof.nonce);
      this.db.exec('COMMIT');return true;
    } catch {this.db.exec('ROLLBACK');return false;}
  }
  close(){this.db.close();}
}
