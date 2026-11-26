import { useState } from 'react';
import {
  PILLAR_META,
  PILLAR_WEIGHTS,
  type PillarKey,
  type PillarScores,
} from '../../packages/core/src/index.ts';

interface PillarRadarChartProps {
  scores: PillarScores;
  accentHex?: string;
}

const ORDERED_PILLARS: PillarKey[] = [
  'functionality',
  'usefulness',
  'anti_slop',
  'creativity',
  'marketability',
];

const CX = 210;
const CY = 175;
const RADIUS = 112;
const RINGS = [25, 50, 75, 100];

function polarPoint(index: number, value: number): { x: number; y: number } {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / ORDERED_PILLARS.length;
  const r = (value / 100) * RADIUS;
  return {
    x: CX + r * Math.cos(angle),
    y: CY + r * Math.sin(angle),
  };
}

function polygonPoints(values: number[]): string {
  return values
    .map((val, idx) => {
      const pt = polarPoint(idx, val);
      return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    })
    .join(' ');
}

export function PillarRadarChart({ scores, accentHex = '#2563EB' }: PillarRadarChartProps) {
  const [hovered, setHovered] = useState<PillarKey | null>(null);

  const scoreValues = ORDERED_PILLARS.map((key) => scores[key]);
  const baselineValues = ORDERED_PILLARS.map(() => 50);

  const activeKey = hovered ?? 'functionality';
  const activeScore = scores[activeKey];
  const activeWeighted = (activeScore * PILLAR_WEIGHTS[activeKey]).toFixed(1);

  return (
    <div className="flex flex-col h-full justify-between">
      <div className="flex items-center justify-between gap-4 pb-3 border-b border-[#F1F5F9]">
        <div>
          <h2 className="text-sm font-semibold text-[#0F172A]">Five-Pillar Radar Profile</h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Dashed polygon indicates the 50/100 working MVP baseline
          </p>
        </div>
        <div className="text-right font-mono text-xs tabular-nums">
          <div className="text-[#0F172A] font-semibold">
            {PILLAR_META[activeKey].shortLabel}: {activeScore}/100
          </div>
          <div className="text-[#64748B]">
            +{activeWeighted} pts ({PILLAR_META[activeKey].weightPct}% wt)
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center py-2">
        <svg
          viewBox="0 0 420 345"
          className="w-full max-w-[400px] h-auto select-none"
          role="img"
          aria-label="Five-pillar benchmark radar chart"
        >
          {/* Concentric scale pentagons */}
          {RINGS.map((ring) => (
            <polygon
              key={ring}
              points={polygonPoints(ORDERED_PILLARS.map(() => ring))}
              fill="none"
              stroke={ring === 50 ? '#94A3B8' : '#E2E8F0'}
              strokeWidth={ring === 50 ? 1.2 : 1}
              strokeDasharray={ring === 50 ? '4 4' : undefined}
            />
          ))}

          {/* Scale ring numeric markers */}
          {RINGS.map((ring) => (
            <text
              key={`lbl-${ring}`}
              x={CX + 5}
              y={CY - (ring / 100) * RADIUS + 3}
              className="fill-[#94A3B8] font-mono"
              fontSize="9.5"
            >
              {ring}
            </text>
          ))}

          {/* Radial axis spokes */}
          {ORDERED_PILLARS.map((key, idx) => {
            const outer = polarPoint(idx, 100);
            return (
              <line
                key={`axis-${key}`}
                x1={CX}
                y1={CY}
                x2={outer.x}
                y2={outer.y}
                stroke="#E2E8F0"
                strokeWidth="1"
              />
            );
          })}

          {/* 50-point MVP anchor baseline */}
          <polygon
            points={polygonPoints(baselineValues)}
            fill="#94A3B8"
            fillOpacity="0.08"
            stroke="#64748B"
            strokeWidth="1.2"
            strokeDasharray="4 4"
          />

          {/* Audited score polygon */}
          <polygon
            points={polygonPoints(scoreValues)}
            fill={accentHex}
            fillOpacity="0.16"
            stroke={accentHex}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />

          {/* Interactive vertex nodes and labels */}
          {ORDERED_PILLARS.map((key, idx) => {
            const pt = polarPoint(idx, scores[key]);
            const labelPt = polarPoint(idx, 124);
            const isActive = hovered === key;
            const anchor =
              Math.abs(labelPt.x - CX) < 15
                ? 'middle'
                : labelPt.x > CX
                  ? 'start'
                  : 'end';

            return (
              <g
                key={key}
                className="cursor-pointer"
                onMouseEnter={() => setHovered(key)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setHovered(key)}
              >
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isActive ? 6.5 : 4.5}
                  fill={isActive ? '#0F172A' : accentHex}
                  stroke="#FFFFFF"
                  strokeWidth="2"
                />
                <text
                  x={labelPt.x}
                  y={labelPt.y}
                  textAnchor={anchor}
                  className={`font-sans ${isActive ? 'fill-[#0F172A] font-semibold' : 'fill-[#334155] font-medium'}`}
                  fontSize="11.5"
                >
                  {PILLAR_META[key].shortLabel}
                </text>
                <text
                  x={labelPt.x}
                  y={labelPt.y + 14}
                  textAnchor={anchor}
                  className="fill-[#64748B] font-mono"
                  fontSize="10.5"
                >
                  {scores[key]} · {PILLAR_META[key].weightPct}%
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Compact tabular pillar strip */}
      <div className="grid grid-cols-5 gap-2 pt-3 border-t border-[#F1F5F9]">
        {ORDERED_PILLARS.map((key) => {
          const val = scores[key];
          return (
            <button
              key={key}
              type="button"
              onMouseEnter={() => setHovered(key)}
              onClick={() => setHovered(key)}
              className={`text-left px-2 py-1.5 rounded transition-colors cursor-pointer ${
                hovered === key ? 'bg-[#F1F5F9]' : 'hover:bg-[#F8FAFC]'
              }`}
            >
              <div className="text-[11px] text-[#64748B] truncate">
                {PILLAR_META[key].shortLabel}
              </div>
              <div className="font-mono text-sm font-semibold text-[#0F172A] tabular-nums">
                {val}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
