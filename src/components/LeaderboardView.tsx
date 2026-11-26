import { useMemo, useState } from 'react';
import { ArrowUpRight, Search, X } from 'lucide-react';
import {
  getTierColor,
  type AuditRecord,
  type Tier,
} from '../../packages/core/src/index.ts';
import { useAuth } from '../context/AuthContext.tsx';

interface LeaderboardViewProps {
  audits: AuditRecord[];
  loading: boolean;
  onSelectAudit: (auditId: string) => void;
  onNavigate: (path: string) => void;
}

type TierFilter = 'All' | Tier;
type SortOption = 'score' | 'lowest_slop' | 'recent';

const TIER_OPTIONS: { value: TierFilter; label: string }[] = [
  { value: 'All', label: 'All Score Tiers' },
  { value: 'Apex Craft', label: 'Apex Craft (90–100)' },
  { value: 'Ship-Ready', label: 'Ship-Ready (75–89)' },
  { value: 'Weekend Hackathon', label: 'Weekend Hackathon (50–74)' },
  { value: 'Certified AI Slop', label: 'Certified AI Slop (25–49)' },
  { value: 'Vaporware', label: 'Vaporware (0–24)' },
];

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return 'Recent';
  }
}

export function LeaderboardView({
  audits,
  loading,
  onSelectAudit,
  onNavigate,
}: LeaderboardViewProps) {
  const { user, signInWithGoogle, logout } = useAuth();
  const [tierFilter, setTierFilter] = useState<TierFilter>('All');
  const [sortBy, setSortBy] = useState<SortOption>('score');
  const [hallOfShame, setHallOfShame] = useState(false);
  const [repoSearch, setRepoSearch] = useState('');

  const summary = useMemo(() => {
    if (audits.length === 0) {
      return { total: 0, median: 0, zeroSlopRate: 0, apexCount: 0 };
    }
    const sortedScores = audits.map((a) => a.overallScore).sort((a, b) => a - b);
    const mid = Math.floor(sortedScores.length / 2);
    const median =
      sortedScores.length % 2 === 0
        ? Math.round((sortedScores[mid - 1] + sortedScores[mid]) / 2)
        : sortedScores[mid];
    const zeroSlop = audits.filter((a) => a.slopHitCount === 0).length;
    const apexCount = audits.filter((a) => a.tier === 'Apex Craft').length;
    return {
      total: audits.length,
      median,
      zeroSlopRate: Math.round((zeroSlop / audits.length) * 100),
      apexCount,
    };
  }, [audits]);

  const filteredAudits = useMemo(() => {
    const q = repoSearch.trim().toLowerCase();
    return audits
      .filter((audit) => {
        if (hallOfShame) {
          if (audit.tier !== 'Certified AI Slop' && audit.tier !== 'Vaporware') {
            return false;
          }
        } else if (tierFilter !== 'All' && audit.tier !== tierFilter) {
          return false;
        }
        if (q && !audit.repoSlug.toLowerCase().includes(q)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (hallOfShame) {
          if (b.slopHitCount !== a.slopHitCount) return b.slopHitCount - a.slopHitCount;
          return a.overallScore - b.overallScore;
        }
        if (sortBy === 'score') {
          if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === 'lowest_slop') {
          if (b.pillarScores.anti_slop !== a.pillarScores.anti_slop) {
            return b.pillarScores.anti_slop - a.pillarScores.anti_slop;
          }
          return a.slopHitCount - b.slopHitCount;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [audits, hallOfShame, tierFilter, repoSearch, sortBy]);

  const hasActiveFilters = hallOfShame || tierFilter !== 'All' || repoSearch.trim().length > 0;

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10 space-y-8">
      {/* Masthead */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-[#E2E8F0]">
        <div className="max-w-2xl">
          <p className="text-xs font-mono text-[#64748B] mb-2">
            Two-Pass Product Benchmark · Anchor 50/100 · Tamper-Evident Receipts
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#0F172A] text-balance leading-tight">
            Verifiable software benchmarks against AI slop
          </h1>
          <p className="text-[15px] text-[#475569] mt-3 leading-relaxed">
            Every receipt pairs deterministic static hygiene metrics with a calibrated multimodal
            judge tied cryptographically to a commit SHA and live deployment snapshot.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {user ? (
            <div className="flex items-center gap-3 text-xs text-[#475569] border border-[#E2E8F0] bg-white rounded-md px-3 py-2">
              <span className="font-mono text-[#0F172A] truncate max-w-[180px]">
                {user.email}
              </span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => void logout()}
                className="text-[#475569] hover:text-[#0F172A] font-medium whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              className="px-4 py-2 text-sm font-medium text-[#0F172A] bg-white border border-[#CBD5E1] rounded-md hover:bg-[#F8FAFC] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Sign In to Publish
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('/rubric')}
            className="px-4 py-2 text-sm font-medium text-[#475569] hover:text-[#0F172A] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            How the Benchmark Works
          </button>
        </div>
      </section>

      {/* Full-width 4-column summary strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 border border-[#E2E8F0] bg-white rounded-lg divide-y lg:divide-y-0 lg:divide-x divide-[#E2E8F0]">
        <div className="p-5">
          <div className="text-xs text-[#64748B]">Audited Receipts</div>
          <div className="text-2xl font-bold font-mono text-[#0F172A] tabular-nums mt-1">
            {summary.total}
          </div>
          <div className="text-xs text-[#64748B] mt-1">Commit-bound public records</div>
        </div>
        <div className="p-5">
          <div className="text-xs text-[#64748B]">Median Benchmark Score</div>
          <div className="text-2xl font-bold font-mono text-[#0F172A] tabular-nums mt-1">
            {summary.median}/100
          </div>
          <div className="text-xs text-[#64748B] mt-1">50 = working MVP baseline</div>
        </div>
        <div className="p-5">
          <div className="text-xs text-[#64748B]">Zero-Slop Rate</div>
          <div className="text-2xl font-bold font-mono text-[#16A34A] tabular-nums mt-1">
            {summary.zeroSlopRate}%
          </div>
          <div className="text-xs text-[#64748B] mt-1">Zero lexicon hits in Pass 1</div>
        </div>
        <div className="p-5">
          <div className="text-xs text-[#64748B]">Apex Craft Receipts</div>
          <div className="text-2xl font-bold font-mono text-[#0F172A] tabular-nums mt-1">
            {summary.apexCount}
          </div>
          <div className="text-xs text-[#64748B] mt-1">Scoring 90–100 across 5 pillars</div>
        </div>
      </section>

      {/* Filter & Sort Toolbar */}
      <section className="space-y-4">
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Repository Name Search Input */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              aria-label="Filter repositories by name"
              value={repoSearch}
              onChange={(e) => setRepoSearch(e.target.value)}
              placeholder="Filter repositories by name (e.g. owner/repo)..."
              className="w-full pl-9 pr-8 py-2 text-xs font-mono bg-[#F8FAFC] border border-[#CBD5E1] rounded-md text-[#0F172A] placeholder:text-[#94A3B8] focus:bg-white focus:outline-none focus:border-[#0F172A] transition-colors"
            />
            {repoSearch && (
              <button
                type="button"
                aria-label="Clear repository search"
                onClick={() => setRepoSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Score Tier Category Dropdown */}
            <label className="flex items-center gap-2 text-xs text-[#64748B]">
              <span className="whitespace-nowrap shrink-0">Score Tier</span>
              <select
                aria-label="Filter by score tier"
                value={hallOfShame ? 'All' : tierFilter}
                onChange={(e) => {
                  setHallOfShame(false);
                  setTierFilter(e.target.value as TierFilter);
                }}
                className="px-3 py-2 text-xs font-medium bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:outline-none focus:border-[#0F172A] cursor-pointer"
              >
                {TIER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            {/* Sort Order Dropdown */}
            <select
              aria-label="Sort leaderboard"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-2 text-xs font-medium bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] focus:outline-none focus:border-[#0F172A] cursor-pointer"
            >
              <option value="score">Sort: Highest Score</option>
              <option value="lowest_slop">Sort: Lowest Slop</option>
              <option value="recent">Sort: Recently Audited</option>
            </select>

            {/* Hall of Shame Toggle */}
            <button
              type="button"
              onClick={() => setHallOfShame((prev) => !prev)}
              className={`px-3 py-2 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                hallOfShame
                  ? 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]'
                  : 'bg-white text-[#475569] border-[#CBD5E1] hover:text-[#0F172A]'
              }`}
            >
              {hallOfShame ? 'Hall of Shame: Active' : 'Hall of Shame'}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-[#64748B] px-1">
          <span className="font-mono tabular-nums">
            Showing {filteredAudits.length} of {audits.length} public receipts
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setHallOfShame(false);
                setTierFilter('All');
                setRepoSearch('');
              }}
              className="text-[#2563EB] hover:underline font-medium cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Precision Leaderboard Table */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-medium text-[#64748B]">
                  <th className="py-3 pl-5 pr-3 w-12">#</th>
                  <th className="py-3 px-3">Repository &amp; Commit</th>
                  <th className="py-3 px-3 text-right w-36">Score &amp; Tier</th>
                  <th className="py-3 px-3 w-48">5-Pillar Profile</th>
                  <th className="py-3 px-3 text-right w-24">Slop Hits</th>
                  <th className="py-3 px-3">Roast Verdict</th>
                  <th className="py-3 pl-3 pr-5 text-right w-32">Audited</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9] text-sm">
                {loading && audits.length === 0 ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={`skel-${i}`}>
                      <td colSpan={7} className="py-4 px-5">
                        <div className="h-5 bg-[#F1F5F9] rounded animate-pulse w-full" />
                      </td>
                    </tr>
                  ))
                ) : filteredAudits.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 px-6 text-center">
                      <p className="text-sm font-medium text-[#0F172A]">
                        No repositories match the active search or score tier filter
                      </p>
                      <p className="text-xs text-[#64748B] mt-1 mb-4">
                        Reset your filters or audit a new repository in the Audit Lab.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setHallOfShame(false);
                          setTierFilter('All');
                          setRepoSearch('');
                        }}
                        className="px-4 py-2 text-xs font-medium bg-[#0F172A] text-white rounded-md hover:bg-[#1E293B] transition-colors cursor-pointer"
                      >
                        Reset Filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredAudits.map((audit, idx) => {
                    const tierStyle = getTierColor(audit.tier);
                    const bars = [
                      { label: 'Func', val: audit.pillarScores.functionality },
                      { label: 'Use', val: audit.pillarScores.usefulness },
                      { label: 'Slop', val: audit.pillarScores.anti_slop },
                      { label: 'Moat', val: audit.pillarScores.creativity },
                      { label: 'Mkt', val: audit.pillarScores.marketability },
                    ];

                    return (
                      <tr
                        key={audit.id}
                        onClick={() => onSelectAudit(audit.id)}
                        className="hover:bg-[#F8FAFC] transition-colors cursor-pointer group"
                      >
                        <td className="py-3.5 pl-5 pr-3 font-mono text-xs text-[#64748B] tabular-nums align-top">
                          {String(idx + 1).padStart(2, '0')}
                        </td>
                        <td className="py-3.5 px-3 align-top">
                          <div className="flex items-center gap-1.5 font-semibold text-[#0F172A] group-hover:text-[#2563EB] transition-colors">
                            <span className="truncate max-w-[210px]">{audit.repoSlug}</span>
                            <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </div>
                          <div className="text-xs text-[#64748B] font-mono tabular-nums mt-0.5">
                            {audit.commitSha.slice(0, 7)}
                            <span aria-hidden="true"> · </span>
                            {audit.fullReport.pass1.totalLoc.toLocaleString()} LOC
                            {audit.isReference ? (
                              <>
                                <span aria-hidden="true"> · </span>
                                <span>Baseline</span>
                              </>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-right align-top">
                          <div className="font-mono text-base font-bold text-[#0F172A] tabular-nums">
                            {audit.overallScore}
                            <span className="text-xs font-normal text-[#94A3B8]">/100</span>
                          </div>
                          <div className={`text-xs font-medium mt-0.5 ${tierStyle.textClass}`}>
                            {audit.tier}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 align-top">
                          <div className="flex items-end gap-1.5 h-9 pt-1">
                            {bars.map((bar) => (
                              <div
                                key={bar.label}
                                className="flex-1 flex flex-col items-center gap-1"
                                title={`${bar.label}: ${bar.val}/100`}
                              >
                                <div className="w-full bg-[#F1F5F9] h-5 rounded-xs overflow-hidden flex items-end">
                                  <div
                                    className="w-full transition-all"
                                    style={{
                                      height: `${Math.max(8, bar.val)}%`,
                                      backgroundColor:
                                        bar.val >= 75
                                          ? '#16A34A'
                                          : bar.val >= 50
                                            ? '#D97706'
                                            : '#DC2626',
                                    }}
                                  />
                                </div>
                                <span className="text-[10px] font-mono text-[#94A3B8]">
                                  {bar.label[0]}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-right align-top font-mono text-xs tabular-nums">
                          <span
                            className={
                              audit.slopHitCount === 0
                                ? 'text-[#16A34A] font-medium'
                                : audit.slopHitCount >= 8
                                  ? 'text-[#DC2626] font-semibold'
                                  : 'text-[#B45309] font-medium'
                            }
                          >
                            {audit.slopHitCount}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 align-top max-w-[300px]">
                          <p className="text-xs text-[#334155] leading-relaxed line-clamp-2">
                            {audit.roastVerdict}
                          </p>
                        </td>
                        <td className="py-3.5 pl-3 pr-5 text-right align-top font-mono text-xs text-[#64748B] tabular-nums whitespace-nowrap">
                          {formatDate(audit.createdAt)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
