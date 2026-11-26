/**
 * ShipCheck Firestore Rules Security Specification Tests (Phase 0 TDD)
 *
 * Verifies the "Dirty Dozen" adversarial payloads against firestore.rules.
 * Each test case models an invariant enforced by our Eight Pillars security rules.
 */

export interface AdversarialTestCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; emailVerified: boolean } | null;
  payload: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
  enforcedByRule: string;
}

export const DIRTY_DOZEN_PAYLOADS: AdversarialTestCase[] = [
  {
    id: 1,
    name: 'Shadow Field Injection on Audit Create',
    collection: 'audits/audit_shadow_01',
    operation: 'create',
    auth: { uid: 'user_alice', emailVerified: true },
    payload: {
      id: 'audit_shadow_01',
      authorUid: 'user_alice',
      repoSlug: 'acme/app',
      commitSha: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
      liveUrl: 'https://example.com',
      bundleHash: 'a'.repeat(64),
      overallScore: 82,
      tier: 'Ship-Ready',
      roastVerdict: 'Clean architecture held back by missing error boundaries.',
      pillarScores: { functionality: 84, usefulness: 82, anti_slop: 88, creativity: 76, marketability: 78 },
      fullReport: {},
      slopHitCount: 0,
      isPublic: true,
      isAdminVerified: true,
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidAudit(incoming()) -> data.keys().hasOnly(...)',
  },
  {
    id: 2,
    name: 'Author UID Spoofing',
    collection: 'audits/audit_spoof_02',
    operation: 'create',
    auth: { uid: 'user_alice', emailVerified: true },
    payload: {
      id: 'audit_spoof_02',
      authorUid: 'user_bob',
      repoSlug: 'acme/app',
      commitSha: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'incoming().authorUid == request.auth.uid',
  },
  {
    id: 3,
    name: 'Score Tampering Update',
    collection: 'audits/audit_existing_03',
    operation: 'update',
    auth: { uid: 'user_alice', emailVerified: true },
    payload: { overallScore: 99, tier: 'Apex Craft' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: "incoming().diff(existing()).affectedKeys().hasOnly(['isPublic', 'updatedAt'])",
  },
  {
    id: 4,
    name: 'Bundle Hash Tampering Update',
    collection: 'audits/audit_existing_04',
    operation: 'update',
    auth: { uid: 'user_alice', emailVerified: true },
    payload: { bundleHash: 'f'.repeat(64) },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'incoming().bundleHash == existing().bundleHash',
  },
  {
    id: 5,
    name: 'Client-Forged Timestamp on Create',
    collection: 'audits/audit_time_05',
    operation: 'create',
    auth: { uid: 'user_alice', emailVerified: true },
    payload: { createdAt: '2020-01-01T00:00:00Z' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'incoming().createdAt == request.time',
  },
  {
    id: 6,
    name: 'Document ID Poisoning (>128 chars or invalid chars)',
    collection: `audits/${'x'.repeat(200)}`,
    operation: 'create',
    auth: { uid: 'user_alice', emailVerified: true },
    payload: {},
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidId(auditId)',
  },
  {
    id: 7,
    name: 'Unverified Email Write Attempt',
    collection: 'audits/audit_unverified_07',
    operation: 'create',
    auth: { uid: 'user_mallory', emailVerified: false },
    payload: { id: 'audit_unverified_07', authorUid: 'user_mallory' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'isVerifiedUser() -> request.auth.token.email_verified == true',
  },
  {
    id: 8,
    name: 'Cross-User PII Profile Read',
    collection: 'users/user_bob',
    operation: 'get',
    auth: { uid: 'user_alice', emailVerified: true },
    payload: {},
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'request.auth.uid == userId',
  },
  {
    id: 9,
    name: 'Users Collection Blanket List Scraping',
    collection: 'users',
    operation: 'list',
    auth: { uid: 'user_alice', emailVerified: true },
    payload: {},
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'allow list: if false;',
  },
  {
    id: 10,
    name: 'Private Audit Read by Non-Owner',
    collection: 'audits/audit_private_10',
    operation: 'get',
    auth: { uid: 'user_bob', emailVerified: true },
    payload: { isPublic: false, authorUid: 'user_alice' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'existing().isPublic == true || existing().authorUid == request.auth.uid',
  },
  {
    id: 11,
    name: 'Orphaned Repo Claim Without Existing Audit',
    collection: 'repoClaims/claim_orphan_11',
    operation: 'create',
    auth: { uid: 'user_alice', emailVerified: true },
    payload: {
      id: 'claim_orphan_11',
      repoSlug: 'acme/ghost',
      ownerUid: 'user_alice',
      auditId: 'nonexistent_audit',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'exists(/databases/$(database)/documents/audits/$(incoming().auditId))',
  },
  {
    id: 12,
    name: 'Out-of-Bounds Score and Invalid Tier',
    collection: 'audits/audit_bounds_12',
    operation: 'create',
    auth: { uid: 'user_alice', emailVerified: true },
    payload: { overallScore: 150, tier: 'God Mode' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidScore(data.overallScore) && isValidTier(data.tier)',
  },
];
