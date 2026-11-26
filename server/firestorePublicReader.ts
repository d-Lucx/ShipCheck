import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };
import { AuditRecordSchema, type AuditRecord } from '../packages/core/src/index.ts';
import { REFERENCE_AUDITS } from '../src/data/referenceAudits.ts';

// Short-lived in-memory cache of audits evaluated by this server instance
const runtimeAuditCache = new Map<string, AuditRecord>();

export function cacheRuntimeAudit(audit: AuditRecord): void {
  runtimeAuditCache.set(audit.id, audit);
  if (runtimeAuditCache.size > 150) {
    const oldestKey = runtimeAuditCache.keys().next().value;
    if (oldestKey) runtimeAuditCache.delete(oldestKey);
  }
}

interface FirestoreValue {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  timestampValue?: string;
  nullValue?: null;
  mapValue?: { fields?: Record<string, FirestoreValue> };
  arrayValue?: { values?: FirestoreValue[] };
}

function decodeFirestoreValue(val: FirestoreValue): unknown {
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return val.doubleValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    return (val.arrayValue?.values ?? []).map(decodeFirestoreValue);
  }
  if ('mapValue' in val) {
    const out: Record<string, unknown> = {};
    const fields = val.mapValue?.fields ?? {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = decodeFirestoreValue(v);
    }
    return out;
  }
  return null;
}

function parseFirestoreDoc(fields: Record<string, FirestoreValue> | undefined): AuditRecord | null {
  if (!fields) return null;
  const decoded = decodeFirestoreValue({ mapValue: { fields } });
  const parsed = AuditRecordSchema.safeParse(decoded);
  return parsed.success ? parsed.data : null;
}

export async function fetchPublicAuditById(auditId: string): Promise<AuditRecord | null> {
  if (!/^[a-zA-Z0-9_-]{4,128}$/.test(auditId)) return null;

  const cached = runtimeAuditCache.get(auditId);
  if (cached && cached.isPublic) return cached;

  const reference = REFERENCE_AUDITS.find((item) => item.id === auditId);
  if (reference) return reference;

  try {
    const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
    const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      firebaseConfig.projectId
    )}/databases/${encodeURIComponent(dbId)}/documents/audits/${encodeURIComponent(
      auditId
    )}?key=${encodeURIComponent(firebaseConfig.apiKey)}`;

    const res = await fetch(endpoint, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const json = (await res.json()) as { fields?: Record<string, FirestoreValue> };
    const audit = parseFirestoreDoc(json.fields);
    if (audit && audit.isPublic) {
      cacheRuntimeAudit(audit);
      return audit;
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchLatestPublicAuditForRepo(
  owner: string,
  repo: string
): Promise<AuditRecord | null> {
  const repoSlug = `${owner}/${repo}`;
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repoSlug)) return null;

  // Check Firestore REST structured query first for freshest published audit
  try {
    const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
    const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      firebaseConfig.projectId
    )}/databases/${encodeURIComponent(dbId)}/documents:runQuery?key=${encodeURIComponent(
      firebaseConfig.apiKey
    )}`;

    const queryBody = {
      structuredQuery: {
        from: [{ collectionId: 'audits' }],
        where: {
          compositeFilter: {
            op: 'AND',
            filters: [
              {
                fieldFilter: {
                  field: { fieldPath: 'isPublic' },
                  op: 'EQUAL',
                  value: { booleanValue: true },
                },
              },
              {
                fieldFilter: {
                  field: { fieldPath: 'repoSlug' },
                  op: 'EQUAL',
                  value: { stringValue: repoSlug },
                },
              },
            ],
          },
        },
        limit: 10,
      },
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queryBody),
      signal: AbortSignal.timeout(4000),
    });

    if (res.ok) {
      const rows = (await res.json()) as Array<{
        document?: { fields?: Record<string, FirestoreValue> };
      }>;
      const matches = rows
        .map((row) => parseFirestoreDoc(row.document?.fields))
        .filter((a): a is AuditRecord => a !== null)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (matches[0]) {
        cacheRuntimeAudit(matches[0]);
        return matches[0];
      }
    }
  } catch {
    // Fallback to runtime cache & reference audits below
  }

  const cachedMatches = Array.from(runtimeAuditCache.values())
    .filter((a) => a.isPublic && a.repoSlug.toLowerCase() === repoSlug.toLowerCase())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  if (cachedMatches[0]) return cachedMatches[0];

  const refMatch = REFERENCE_AUDITS.find(
    (a) => a.repoSlug.toLowerCase() === repoSlug.toLowerCase()
  );
  return refMatch ?? null;
}
