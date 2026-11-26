import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  AuditRecordSchema,
  type AuditRecord,
} from '../../packages/core/src/index.ts';
import { db, handleFirestoreError, OperationType } from './firebase.ts';

function normalizeTimestamp(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  return new Date().toISOString();
}

function parseFirestoreAudit(raw: Record<string, unknown>): AuditRecord | null {
  const candidate = {
    ...raw,
    createdAt: normalizeTimestamp(raw.createdAt),
    isReference: false,
  };
  const parsed = AuditRecordSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function subscribePublicAudits(
  onUpdate: (audits: AuditRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'audits';
  const q = query(collection(db, path), where('isPublic', '==', true), limit(60));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: AuditRecord[] = [];
      for (const docSnap of snapshot.docs) {
        const parsed = parseFirestoreAudit(docSnap.data() as Record<string, unknown>);
        if (parsed) items.push(parsed);
      }
      onUpdate(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export function subscribeUserAudits(
  uid: string,
  onUpdate: (audits: AuditRecord[]) => void
): Unsubscribe {
  const path = 'audits';
  const q = query(collection(db, path), where('authorUid', '==', uid), limit(40));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: AuditRecord[] = [];
      for (const docSnap of snapshot.docs) {
        const parsed = parseFirestoreAudit(docSnap.data() as Record<string, unknown>);
        if (parsed) items.push(parsed);
      }
      onUpdate(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch {
        // Handled cleanly in caller state
      }
    }
  );
}

export async function getAuditFromFirestore(auditId: string): Promise<AuditRecord | null> {
  if (!/^[a-zA-Z0-9_-]{4,128}$/.test(auditId)) return null;
  const path = `audits/${auditId}`;
  try {
    const snap = await getDoc(doc(db, 'audits', auditId));
    if (!snap.exists()) return null;
    return parseFirestoreAudit(snap.data() as Record<string, unknown>);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function publishAuditToFirestore(
  audit: AuditRecord,
  user: User,
  isPublic = true
): Promise<AuditRecord> {
  const sanitizedId = audit.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  const path = `audits/${sanitizedId}`;
  const cleanLiveUrl =
    audit.liveUrl && /^https?:\/\//i.test(audit.liveUrl.trim())
      ? audit.liveUrl.trim().slice(0, 512)
      : '';

  const payload = {
    id: sanitizedId,
    authorUid: user.uid,
    repoSlug: audit.repoSlug.slice(0, 140),
    commitSha: audit.commitSha.slice(0, 40),
    liveUrl: cleanLiveUrl,
    bundleHash: audit.bundleHash.slice(0, 64),
    overallScore: Math.round(audit.overallScore),
    tier: audit.tier,
    roastVerdict: audit.roastVerdict.slice(0, 280),
    pillarScores: {
      functionality: Math.round(audit.pillarScores.functionality),
      usefulness: Math.round(audit.pillarScores.usefulness),
      anti_slop: Math.round(audit.pillarScores.anti_slop),
      creativity: Math.round(audit.pillarScores.creativity),
      marketability: Math.round(audit.pillarScores.marketability),
    },
    fullReport: audit.fullReport,
    slopHitCount: Math.max(0, Math.min(10000, Math.round(audit.slopHitCount))),
    isPublic,
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'audits', sanitizedId), payload);
    return {
      ...audit,
      id: sanitizedId,
      authorUid: user.uid,
      liveUrl: cleanLiveUrl,
      isPublic,
      isReference: false,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function toggleAuditVisibility(auditId: string, isPublic: boolean): Promise<void> {
  const path = `audits/${auditId}`;
  try {
    await updateDoc(doc(db, 'audits', auditId), {
      isPublic,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteAuditFromFirestore(auditId: string): Promise<void> {
  const path = `audits/${auditId}`;
  try {
    await deleteDoc(doc(db, 'audits', auditId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncUserProfile(user: User): Promise<void> {
  if (!user.email || !user.emailVerified) return;
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    const displayName = (user.displayName || user.email.split('@')[0] || 'Builder').slice(0, 120);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        email: user.email.slice(0, 254),
        displayName,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        displayName,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function claimRepoOwnership(
  repoSlug: string,
  auditId: string,
  user: User
): Promise<string> {
  const claimId = `${repoSlug.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${user.uid.slice(0, 8)}`.slice(
    0,
    120
  );
  const path = `repoClaims/${claimId}`;
  try {
    await setDoc(doc(db, 'repoClaims', claimId), {
      id: claimId,
      repoSlug: repoSlug.slice(0, 140),
      ownerUid: user.uid,
      auditId,
      createdAt: serverTimestamp(),
    });
    return claimId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}
