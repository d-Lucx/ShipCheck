import { GoogleGenAI, Type } from '@google/genai';
import {
  JudgeOutputSchema,
  computeOverallScore,
  computeTier,
  type AuditBundle,
  type AuditReport,
  type JudgeOutput,
  type PillarScores,
  type Tier,
} from '../packages/core/src/index.ts';

const JUDGE_MODEL = 'gemini-4-hydrogen';

const JUDGE_SYSTEM_INSTRUCTION = `You are the ShipCheck Calibrated Software & Product Judge.
You evaluate shipped repositories and deployed products across 5 weighted pillars on a strict 0-100 scale.

CALIBRATION RULES (NON-NEGOTIABLE):
1. Anchor at 50: 50 is the baseline for a working MVP. Do NOT grade on a school curve.
2. Deduction-First: Award points above 50 ONLY for concrete evidence directly visible in the Pass 1 deterministic metrics, selected source files, live URL probe, or attached screenshots.
3. Strict Evidence Citations: Every item in strengths[] and deductions[] MUST cite a concrete file path (e.g. "server.ts"), DOM element, copy phrase, or Pass 1 metric (e.g. "totalSlopHits: 0", "largestFile: 210 LOC").
4. Anti-Slop Discipline: Penalize monolithic files (>800 LOC), exposed secrets, leftover unfinished markers, excessive thin-wrapper ratios, generic templates, and marketing cliché hits. Reward clean modular architecture, input validation (Zod/Pydantic), error boundaries, rate limiting, and crisp domain-native copy.
5. Roast Verdict: Produce ONE sharp, constructive sentence (strictly <= 28 words) summarizing the product's core strength and biggest flaw or remaining gap.
6. Top Fixes: Provide 1 to 3 concrete, actionable engineering or product fixes referencing specific files or workflows.`;

export interface ScreenshotInput {
  label: 'desktop' | 'mobile';
  mimeType: string;
  base64Data: string;
}

export interface EvaluatedAuditResult {
  overallScore: number;
  tier: Tier;
  roastVerdict: string;
  pillarScores: PillarScores;
  fullReport: AuditReport;
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Set it in Settings > Secrets to run Pass 2 evaluation.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function buildPillarSchema() {
  return {
    type: Type.OBJECT,
    properties: {
      score: {
        type: Type.INTEGER,
        description: 'Calibrated integer score from 0 to 100 anchored at 50 for a working MVP.',
      },
      summary: {
        type: Type.STRING,
        description: 'Concise 1-2 sentence assessment grounded in the bundle.',
      },
      strengths: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: '1-4 cited strengths referencing exact file paths, DOM elements, or metrics.',
      },
      deductions: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: '0-4 cited deductions referencing exact file paths, DOM elements, or metrics.',
      },
    },
    required: ['score', 'summary', 'strengths', 'deductions'],
  };
}

export async function runCalibratedJudge(
  bundle: AuditBundle,
  screenshots: ScreenshotInput[] = []
): Promise<EvaluatedAuditResult> {
  const ai = getGeminiClient();

  const promptPayload = {
    repoSlug: bundle.repoSlug,
    commitSha: bundle.commitSha,
    liveUrl: bundle.liveUrl || null,
    bundleHash: bundle.bundleHash,
    pass1Metrics: bundle.metrics,
    selectedFiles: bundle.selectedFiles.map((f) => ({
      path: f.path,
      loc: f.loc,
      excerpt: f.excerpt,
    })),
  };

  const parts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [
    {
      text: `Audit this ShipCheck Pass 1 bundle strictly according to the 5-pillar rubric (Functionality & Craft, Usefulness, Anti-Slop Score, Creativity & Moat, Marketability). Return valid JSON matching the schema.\n\nAUDIT_BUNDLE:\n${JSON.stringify(promptPayload)}`,
    },
  ];

  for (const shot of screenshots.slice(0, 2)) {
    if (shot.base64Data && /^image\/(png|jpeg|webp)$/.test(shot.mimeType)) {
      parts.push({
        inlineData: {
          mimeType: shot.mimeType,
          data: shot.base64Data,
        },
      });
    }
  }

  let rawText = '';
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: JUDGE_MODEL,
        contents: { parts },
        config: {
          systemInstruction: JUDGE_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              pillars: {
                type: Type.OBJECT,
                properties: {
                  functionality: buildPillarSchema(),
                  usefulness: buildPillarSchema(),
                  anti_slop: buildPillarSchema(),
                  creativity: buildPillarSchema(),
                  marketability: buildPillarSchema(),
                },
                required: [
                  'functionality',
                  'usefulness',
                  'anti_slop',
                  'creativity',
                  'marketability',
                ],
              },
              roastVerdict: {
                type: Type.STRING,
                description:
                  'One sharp, constructive sentence (<= 28 words) summarizing core strength and biggest flaw.',
              },
              topFixes: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '1-3 concrete, prioritized engineering or product fixes.',
              },
            },
            required: ['pillars', 'roastVerdict', 'topFixes'],
          },
        },
      });

      rawText = (response.text ?? '').trim();
      if (rawText) break;
    } catch (err) {
      lastError = err;
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
    }
  }

  if (!rawText) {
    const message =
      lastError instanceof Error ? lastError.message : 'Gemini judge returned an empty response.';
    throw new Error(`Pass 2 evaluation failed: ${message}`);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    throw new Error('Pass 2 judge returned malformed JSON output.');
  }

  const validated: JudgeOutput = JudgeOutputSchema.parse(parsedJson);

  const pillarScores: PillarScores = {
    functionality: validated.pillars.functionality.score,
    usefulness: validated.pillars.usefulness.score,
    anti_slop: validated.pillars.anti_slop.score,
    creativity: validated.pillars.creativity.score,
    marketability: validated.pillars.marketability.score,
  };

  // Deterministic math — never trust LLM arithmetic
  const overallScore = computeOverallScore(pillarScores);
  const tier = computeTier(overallScore);

  const fullReport: AuditReport = {
    pass1: bundle.metrics,
    pass2: validated,
    fileManifest: bundle.selectedFiles.map((f) => ({ path: f.path, loc: f.loc })),
    evaluatedAt: new Date().toISOString(),
    judgeModel: JUDGE_MODEL,
  };

  return {
    overallScore,
    tier,
    roastVerdict: validated.roastVerdict.slice(0, 280),
    pillarScores,
    fullReport,
  };
}
