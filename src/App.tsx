import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AuditRecord } from '../packages/core/src/index.ts';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { TopBar, type AppRoute } from './components/TopBar.tsx';
import { LeaderboardView } from './components/LeaderboardView.tsx';
import { AuditLabView } from './components/AuditLabView.tsx';
import { AuditReceiptView } from './components/AuditReceiptView.tsx';
import { RubricView } from './components/RubricView.tsx';
import { CliCiView } from './components/CliCiView.tsx';
import { REFERENCE_AUDITS } from './data/referenceAudits.ts';
import {
  getAuditFromFirestore,
  subscribePublicAudits,
  subscribeUserAudits,
} from './lib/auditStore.ts';

function parseLocation(pathname: string): { route: AppRoute; auditId: string | null } {
  if (pathname.startsWith('/r/')) {
    const id = decodeURIComponent(pathname.slice(3).split('/')[0] || '');
    return { route: 'receipt', auditId: id || null };
  }
  if (pathname.startsWith('/audit')) return { route: 'audit', auditId: null };
  if (pathname.startsWith('/rubric')) return { route: 'rubric', auditId: null };
  if (pathname.startsWith('/cli')) return { route: 'cli', auditId: null };
  return { route: 'leaderboard', auditId: null };
}

function ShipCheckShell() {
  const { user } = useAuth();
  const [pathname, setPathname] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

  const [firestorePublicAudits, setFirestorePublicAudits] = useState<AuditRecord[]>([]);
  const [userAudits, setUserAudits] = useState<AuditRecord[]>([]);
  const [sessionAudits, setSessionAudits] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [directReceipt, setDirectReceipt] = useState<AuditRecord | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  const { route, auditId } = useMemo(() => parseLocation(pathname), [pathname]);

  const navigate = useCallback((nextPath: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', nextPath);
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    setPathname(nextPath);
  }, []);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Subscribe to public leaderboard audits in Firestore
  useEffect(() => {
    const unsub = subscribePublicAudits(
      (items) => {
        setFirestorePublicAudits(items);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  // Subscribe to current authenticated user's own audits (including private receipts)
  useEffect(() => {
    if (!user) {
      setUserAudits([]);
      return;
    }
    const unsub = subscribeUserAudits(user.uid, setUserAudits);
    return unsub;
  }, [user]);

  // Combined deduplicated leaderboard list (Firestore live records + session + reference baselines)
  const allKnownAudits = useMemo(() => {
    const map = new Map<string, AuditRecord>();
    for (const ref of REFERENCE_AUDITS) {
      map.set(ref.id, ref);
    }
    for (const item of sessionAudits) {
      map.set(item.id, item);
    }
    for (const item of firestorePublicAudits) {
      map.set(item.id, item);
    }
    for (const item of userAudits) {
      map.set(item.id, item);
    }
    return Array.from(map.values());
  }, [firestorePublicAudits, userAudits, sessionAudits]);

  const leaderboardAudits = useMemo(
    () => allKnownAudits.filter((a) => a.isPublic),
    [allKnownAudits]
  );

  // Hydrate direct /r/:auditId navigation if not already in memory
  useEffect(() => {
    if (route !== 'receipt' || !auditId) {
      setDirectReceipt(null);
      return;
    }
    const existing = allKnownAudits.find((a) => a.id === auditId);
    if (existing) {
      setDirectReceipt(existing);
      return;
    }

    let cancelled = false;
    setReceiptLoading(true);
    (async () => {
      try {
        const fromFs = await getAuditFromFirestore(auditId);
        if (!cancelled && fromFs) {
          setDirectReceipt(fromFs);
          setReceiptLoading(false);
          return;
        }
      } catch {
        // Fallback to server receipt endpoint
      }

      try {
        const res = await fetch(`/api/receipts/${encodeURIComponent(auditId)}`);
        if (!cancelled && res.ok) {
          const data = (await res.json()) as AuditRecord;
          setDirectReceipt(data);
        }
      } catch {
        // Not found
      } finally {
        if (!cancelled) setReceiptLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [route, auditId, allKnownAudits]);

  const handleAuditCreated = useCallback((audit: AuditRecord) => {
    setSessionAudits((prev) => [audit, ...prev.filter((item) => item.id !== audit.id)]);
  }, []);

  const handleAuditDeleted = useCallback((deletedId: string) => {
    setSessionAudits((prev) => prev.filter((item) => item.id !== deletedId));
    setDirectReceipt(null);
  }, []);

  const activeReceipt = useMemo(() => {
    if (route !== 'receipt' || !auditId) return null;
    return allKnownAudits.find((a) => a.id === auditId) ?? directReceipt;
  }, [route, auditId, allKnownAudits, directReceipt]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      <TopBar activeRoute={route} onNavigate={navigate} />

      <main className="flex-1">
        {route === 'leaderboard' && (
          <LeaderboardView
            audits={leaderboardAudits}
            loading={loading}
            onSelectAudit={(id) => navigate(`/r/${encodeURIComponent(id)}`)}
            onNavigate={navigate}
          />
        )}

        {route === 'audit' && (
          <AuditLabView
            onAuditCreated={handleAuditCreated}
            onOpenReceipt={(id) => navigate(`/r/${encodeURIComponent(id)}`)}
          />
        )}

        {route === 'rubric' && <RubricView />}

        {route === 'cli' && <CliCiView />}

        {route === 'receipt' && (
          <>
            {receiptLoading && !activeReceipt ? (
              <div className="max-w-[1200px] mx-auto px-6 py-16 text-center text-sm text-[#64748B]">
                Loading verifiable audit receipt...
              </div>
            ) : activeReceipt ? (
              <AuditReceiptView
                audit={activeReceipt}
                onBack={() => navigate('/')}
                onDeleted={handleAuditDeleted}
                onUpdated={handleAuditCreated}
              />
            ) : (
              <div className="max-w-lg mx-auto px-6 py-20 text-center space-y-4">
                <h1 className="text-xl font-bold text-[#0F172A]">Receipt Not Found</h1>
                <p className="text-sm text-[#64748B]">
                  This receipt ID does not exist or has been set to private by its owner.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="px-4 py-2 text-sm font-medium bg-[#0F172A] text-white rounded-md hover:bg-[#1E293B] transition-colors cursor-pointer"
                >
                  Return to Leaderboard
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-[#E2E8F0] bg-white mt-16">
        <div className="max-w-[1200px] mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#64748B]">
          <span>ShipCheck · Deterministic Anti-Slop &amp; Product Benchmark</span>
          <div className="flex items-center gap-5">
            <a
              href="/rubric"
              onClick={(e) => {
                e.preventDefault();
                navigate('/rubric');
              }}
              className="hover:text-[#0F172A] transition-colors"
            >
              Benchmark Rubric
            </a>
            <a
              href="/cli"
              onClick={(e) => {
                e.preventDefault();
                navigate('/cli');
              }}
              className="hover:text-[#0F172A] transition-colors"
            >
              CLI &amp; GitHub Action
            </a>
            <a
              href="/audit"
              onClick={(e) => {
                e.preventDefault();
                navigate('/audit');
              }}
              className="hover:text-[#0F172A] transition-colors"
            >
              Audit Lab
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ShipCheckShell />
      </AuthProvider>
    </ErrorBoundary>
  );
}
