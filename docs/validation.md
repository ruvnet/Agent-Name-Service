# Validation record

Date: 2026-09-10. Node 24 and Python 3.12 on the managed local runner.

10 Node domain tests passed covering signatures, pinned issuer, expiry, tampering, SQLite persistence, revocation, audience, challenge expiry and replay. Ed25519 fixture 1000 iterations: p50 0.179 ms and p95 0.431 ms. Root npm audit found zero dependencies and zero advisories.

3 runtime tests passed through the official MCP SDK 2 stdio client, including a real domain operation, tool and resource discovery, unknown operation denial, invalid fields, local validation opt in and receipt generation. Runtime npm audit: zero known vulnerabilities.

Generated MetaHarness profiles: 7 tests, build, doctor, benchmark generation/verification and audit passed. Autogenous gate: 6 Rust tests passed against the pinned upstream agl-types implementation. These are local regression and fixture results, not independent model evaluation or production certification. Check GitHub Actions on the final commit before merging.
