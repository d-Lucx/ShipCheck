# ShipCheck Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Default Deny**: All unmatched paths in Firestore are denied for both reads and writes.
2. **Receipt Immutability**: Once an `/audits/{auditId}` document is created, its `id`, `authorUid`, `repoSlug`, `commitSha`, `bundleHash`, `overallScore`, `tier`, `roastVerdict`, `pillarScores`, `fullReport`, `slopHitCount`, and `createdAt` can NEVER be altered. Only the original author may toggle `isPublic` (alongside server-enforced `updatedAt == request.time`).
3. **Verified Identity**: All writes across `/audits`, `/users`, and `/repoClaims` require `request.auth != null && request.auth.token.email_verified == true`.
4. **PII Isolation**: `/users/{userId}` documents contain user email addresses and can ONLY be read or written by the exact owner (`request.auth.uid == userId`). Blanket `list` on `/users` is strictly forbidden.
5. **Relational Integrity**: A `/repoClaims/{claimId}` document cannot be created unless the referenced `/audits/{auditId}` document exists in Firestore.
6. **Public vs. Private Isolation**: Unauthenticated and non-owner reads on `/audits/{auditId}` are permitted ONLY when `resource.data.isPublic == true`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection on Audit Create**: Valid audit payload plus ghost field `isAdminVerified: true` -> MUST return `PERMISSION_DENIED`.
2. **Author UID Spoofing**: Authenticated user `uid_a` attempts to create `/audits/audit_1` with `authorUid: "uid_b"` -> MUST return `PERMISSION_DENIED`.
3. **Score Tampering Update**: Author attempts to update `overallScore` from `42` to `99` on their own existing audit -> MUST return `PERMISSION_DENIED`.
4. **Bundle Hash Tampering Update**: Author attempts to overwrite `bundleHash` on an existing audit -> MUST return `PERMISSION_DENIED`.
5. **Client-Forged Timestamp**: Create audit with client-chosen `createdAt` instead of `request.time` -> MUST return `PERMISSION_DENIED`.
6. **ID Poisoning**: Create audit with a 200-char document ID containing spaces or path characters -> MUST return `PERMISSION_DENIED`.
7. **Unverified Email Write**: Authenticated token with `email_verified: false` attempts to create an audit -> MUST return `PERMISSION_DENIED`.
8. **Cross-User PII Read**: User `uid_a` attempts `get` on `/users/uid_b` -> MUST return `PERMISSION_DENIED`.
9. **Users Collection Scraping**: Authenticated user attempts `list` on `/users` -> MUST return `PERMISSION_DENIED`.
10. **Private Audit Exfiltration**: Anonymous or non-owner user attempts `get` or `list` on an audit where `isPublic == false` -> MUST return `PERMISSION_DENIED`.
11. **Orphaned Repo Claim**: Authenticated user creates `/repoClaims/claim_1` pointing to a non-existent `auditId` -> MUST return `PERMISSION_DENIED`.
12. **Out-of-Bounds Score / Invalid Tier**: Create audit with `overallScore: 150` or `tier: "God Mode"` -> MUST return `PERMISSION_DENIED`.
