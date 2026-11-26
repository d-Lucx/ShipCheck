import type { LiveProbeMetrics } from '../../core/src/schema.ts';
import { validateSafePublicUrl } from '../../../server/urlSafety.ts';

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFirstMatch(html: string, regex: RegExp): string {
  const match = html.match(regex);
  return match?.[1] ? stripTags(match[1]).slice(0, 220) : '';
}

function extractCtaCandidates(html: string): string[] {
  const candidates: string[] = [];
  const regex = /<(?:button|a)\b[^>]*>([\s\S]*?)<\/(?:button|a)>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null && candidates.length < 8) {
    const text = stripTags(match[1]);
    if (text.length >= 2 && text.length <= 42 && !candidates.includes(text)) {
      candidates.push(text);
    }
  }
  return candidates;
}

export async function probeLiveUrl(rawUrl: string): Promise<LiveProbeMetrics> {
  const parsed = validateSafePublicUrl(rawUrl);
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(parsed.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'ShipCheck-Probe/1.0 (+https://shipcheck.dev)',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      },
    });

    // Verify final redirected URL is still safe
    if (response.url) {
      validateSafePublicUrl(response.url);
    }

    const ttfbMs = Date.now() - startedAt;
    const html = (await response.text()).slice(0, 180_000);

    const title = extractFirstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const metaDescription =
      extractFirstMatch(
        html,
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i
      ) ||
      extractFirstMatch(
        html,
        /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i
      );
    const h1Text = extractFirstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const ctaText = extractCtaCandidates(html);
    const hasViewportMeta = /<meta[^>]+name=["']viewport["'][^>]*>/i.test(html);

    const consoleErrors: string[] = [];
    if (response.status >= 400) {
      consoleErrors.push(`HTTP ${response.status} returned from ${parsed.hostname}`);
    }
    if (!title) {
      consoleErrors.push('Missing <title> tag in HTML document head');
    }

    return {
      url: parsed.toString(),
      httpStatus: response.status,
      ttfbMs,
      title,
      metaDescription,
      h1Text,
      ctaText,
      consoleErrors,
      failedRequests: response.status >= 400 ? 1 : 0,
      hasViewportMeta,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Live URL probe timed out';
    return {
      url: parsed.toString(),
      httpStatus: 0,
      ttfbMs: Date.now() - startedAt,
      title: '',
      metaDescription: '',
      h1Text: '',
      ctaText: [],
      consoleErrors: [message],
      failedRequests: 1,
      hasViewportMeta: false,
    };
  } finally {
    clearTimeout(timeout);
  }
}
