/** Historical mock service retired. Use v2/identity.mjs for real signed bindings. */
export class CertificateService {
    public initialized = false;
    async initialize(): Promise<never> { throw new Error('Historical service retired'); }
    async revokeCertificate(_id: string, _reason: string): Promise<never> { throw new Error('Historical service retired'); }
    async renewCertificate(_id: string): Promise<never> { throw new Error('Historical service retired'); }
    async generateKeyPair(): Promise<never> { throw new Error('Historical service retired'); }
    generateCertificate(_subject: string): never { throw new Error('Historical service retired'); }
    validateCertificate(_certificate: string) { return {valid: false,reason: 'Historical service retired'}; }
}
