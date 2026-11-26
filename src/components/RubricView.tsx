import { useState } from 'react';
import {
  computeOverallScore,
  computeTier,
  getTierColor,
  PILLAR_META,
  PILLAR_WEIGHTS,
  SLOP_LEXICON,
  type PillarKey,
  type PillarScores,
} from '../../packages/core/src/index.ts';

const ORDERED_PILLARS: PillarKey[] = [
  'functionality',
  'usefulness',
  'anti_slop',
  'creativity',
  'marketability',
];

const TIER_SCALE = [
  { range: '90–100', name: 'Apex Craft', desc: 'Top 1% production craft, durable moat, near-zero slop.' },
  { range: '75–89', name: 'Ship-Ready', desc: 'Solid engineering, clear utility, minor polish needed.' },
  { range: '50–74', name: 'Weekend Hackathon', desc: 'Functional MVP or prototype, crowded or template-heavy.' },
  { range: '25–49', name: 'Certified AI Slop', desc: 'Heavy boilerplate, wrapper bloat, and cliché copy.' },
  { range: '0–24', name: 'Vaporware', desc: 'Broken build, non-functional links, or unbacked buzzwords.' },
] as const;

export function RubricView() {
  const [simScores, setSimScores] = useState<PillarScores>({
    functionality: 86,
    usefulness: 84,
    anti_slop: 92,
    creativity: 78,
    marketability: 80,
  });

  const overall = computeOverallScore(simScores);
  const tier = computeTier(overall);
  const tierStyle = getTierColor(tier);

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10 space-y-10">
      <section className="max-w-3xl pb-6 border-b border-[#E2E8F0]">
        <p className="text-xs font-mono text-[#64748B] mb-2">
          Calibration Specification · Deterministic Weighted Formula
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-[#0F172A] text-balance">
          How the ShipCheck Benchmark Works
        </h1>
        <p className="text-sm text-[#475569] mt-3 leading-relaxed">
          ShipCheck rejects inflated novelty scoring by anchoring working MVPs strictly at 50/100,
          verifying static code hygiene before calling any model, and computing every final score
          and tier deterministically in TypeScript.
        </p>
      </section>

      {/* Interactive Deterministic Weight Calculator */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-lg p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-[#0F172A]">
              Interactive Weighted Score Simulator
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Adjust any pillar to verify the exact deterministic formula executed by{' '}
              <code className="font-mono text-[#0F172A]">packages/core</code>
            </p>
          </div>

          <div className="space-y-4">
            {ORDERED_PILLARS.map((key) => {
              const meta = PILLAR_META[key];
              const value = simScores[key];
              return (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor={`sim-${key}`} className="font-medium text-[#0F172A]">
                      {meta.label}{' '}
                      <span className="font-mono text-[#64748B]">({meta.weightPct}%)</span>
                    </label>
                    <span className="font-mono font-semibold text-[#0F172A] tabular-nums">
                      {value}/100 · +{(value * PILLAR_WEIGHTS[key]).toFixed(1)} pts
                    </span>
                  </div>
                  <input
                    id={`sim-${key}`}
                    type="range"
                    min={0}
                    max={100}
                    value={value}
                    onChange={(e) =>
                      setSimScores((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                    }
                    className="w-full accent-[#0F172A] cursor-pointer"
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-lg p-6 flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <div className="text-xs text-[#64748B]">Deterministic Output</div>
            <div className="flex items-baseline justify-between gap-4 pb-4 border-b border-[#F1F5F9]">
              <div className="text-5xl font-bold font-mono text-[#0F172A] tabular-nums">
                {overall}
                <span className="text-lg font-normal text-[#94A3B8]">/100</span>
              </div>
              <div className={`text-base font-bold ${tierStyle.textClass}`}>{tier}</div>
            </div>
            <pre className="p-3 bg-[#0F172A] text-[#E2E8F0] rounded-md text-[11px] font-mono overflow-x-auto leading-relaxed">
{`overall_score = Math.round(
  (${simScores.functionality} * 0.25) +
  (${simScores.usefulness} * 0.25) +
  (${simScores.anti_slop} * 0.20) +
  (${simScores.creativity} * 0.15) +
  (${simScores.marketability} * 0.15)
) // => ${overall}`}
            </pre>
          </div>

          <div className="space-y-2 pt-3 border-t border-[#F1F5F9]">
            <div className="text-xs font-semibold text-[#0F172A]">Deterministic Output Tiers</div>
            <div className="space-y-1.5">
              {TIER_SCALE.map((row) => (
                <div
                  key={row.name}
                  className={`flex items-baseline justify-between gap-3 text-xs py-1 px-2 rounded ${
                    tier === row.name ? 'bg-[#F1F5F9] font-semibold text-[#0F172A]' : 'text-[#475569]'
                  }`}
                >
                  <span className="font-mono w-14 shrink-0 tabular-nums">{row.range}</span>
                  <span className="w-36 shrink-0">{row.name}</span>
                  <span className="text-[#64748B] truncate">{row.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 5-Pillar Rubric Matrix */}
      <section className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden">
        <div className="p-6 border-b border-[#E2E8F0]">
          <h2 className="text-base font-semibold text-[#0F172A]">
            Five-Pillar Evaluation Matrix
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-medium text-[#64748B]">
                <th className="py-3 px-6 w-56">Pillar</th>
                <th className="py-3 px-4 w-24 text-right">Weight</th>
                <th className="py-3 px-6">Core Evaluation Criteria</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {ORDERED_PILLARS.map((key, idx) => {
                const meta = PILLAR_META[key];
                return (
                  <tr key={key}>
                    <td className="py-4 px-6 font-semibold text-[#0F172A] align-top">
                      0{idx + 1}. {meta.label}
                    </td>
                    <td className="py-4 px-4 text-right font-mono font-semibold text-[#0F172A] tabular-nums align-top">
                      {meta.weightPct}%
                    </td>
                    <td className="py-4 px-6 text-[#475569] leading-relaxed align-top">
                      {meta.criteria}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pass 1 Deterministic Slop Lexicon */}
      <section className="bg-white border border-[#E2E8F0] rounded-lg p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-[#0F172A]">
            Pass 1 Deterministic Slop Lexicon
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Scanned deterministically across UI and Markdown files (.tsx, .jsx, .html, .md, .mdx)
            with exact file path attribution and weighted penalties
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {SLOP_LEXICON.map((entry) => (
            <div
              key={entry.phrase}
              className="border border-[#E2E8F0] rounded-md px-3.5 py-2.5 flex items-center justify-between text-xs"
            >
              <span className="font-mono text-[#0F172A]">{entry.phrase}</span>
              <span className="font-mono text-[#DC2626] tabular-nums">−{entry.weight}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
