import { describe, expect, it } from 'vitest';
import { extractDocumentationEvidence } from '../../packages/server/src/documentation-evidence-parser.js';

const knownKeys = ['workflow.auto_advance', 'model_profile'];
const limits = { maxSourceBytes: 16_384, maxHeadings: 32, maxSectionBytes: 4_096 };
const markdown = `# Configuration\n\n## Workflow {#workflow}\n\nUse \`workflow.auto_advance\` to continue safely.\n\n## Model profile {#model-profile}\n\nSet \`model_profile\` for the desired quality.`;

describe('extractDocumentationEvidence', () => {
  it('associates configured headings, anchors, and exact key tokens deterministically', () => {
    const result = extractDocumentationEvidence(markdown, knownKeys, limits);

    expect(result.fingerprints).toEqual({
      'model_profile': expect.any(String),
      'workflow.auto_advance': expect.any(String),
    });
    expect(result.diagnostics).toEqual([]);
  });

  it('normalizes line endings, Unicode, heading spacing, and internal whitespace', () => {
    const normalized = extractDocumentationEvidence(markdown, knownKeys, limits);
    const variant = extractDocumentationEvidence(`# Configuration\r\n\r\n##   Workflow   {#workflow}\r\n\r\nUse  \`workflow.auto_advance\`  to continue safely.\r\n\r\n## Model profile {#model-profile}\r\n\r\nSet \`model_profile\` for the desired qualité.`, knownKeys, limits);
    const composed = extractDocumentationEvidence(`# Configuration\n\n## Workflow {#workflow}\n\nUse \`workflow.auto_advance\` to continue safely.\n\n## Model profile {#model-profile}\n\nSet \`model_profile\` for the desired qualité.`, knownKeys, limits);

    expect(variant.fingerprints.workflow.auto_advance).toBe(normalized.fingerprints.workflow.auto_advance);
    expect(variant.fingerprints.model_profile).toBe(composed.fingerprints.model_profile);
  });

  it.each([
    ['duplicate heading', `## Workflow {#workflow}\n\`workflow.auto_advance\`\n\n## Workflow {#workflow-two}\n\`workflow.auto_advance\``],
    ['multiple key claims', `## Combined {#combined}\n\`workflow.auto_advance\` and \`model_profile\``],
    ['repeated key claim', `## Workflow {#workflow}\n\`workflow.auto_advance\`\n\n## Again {#again}\n\`workflow.auto_advance\``],
    ['malformed anchor', `## Workflow {#bad anchor}\n\`workflow.auto_advance\``],
  ])('does not fabricate a fingerprint for %s', (_name, input) => {
    const result = extractDocumentationEvidence(input, knownKeys, limits);

    expect(result.fingerprints.workflow?.auto_advance).toBeUndefined();
    expect(result.diagnostics.some((diagnostic: { key?: string }) => diagnostic.key === 'workflow.auto_advance')).toBe(true);
  });

  it('returns explicit evidence-unavailable diagnostics for missing and ambiguous associations', () => {
    const result = extractDocumentationEvidence('## Workflow {#workflow}\nNo key token here.', knownKeys, limits);

    expect(result.fingerprints).toEqual({});
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'workflow.auto_advance', status: 'unavailable' }),
      expect.objectContaining({ key: 'model_profile', status: 'unavailable' }),
    ]));
  });

  it('changes only the edited key fingerprint for a prose-only edit', () => {
    const before = extractDocumentationEvidence(markdown, knownKeys, limits);
    const after = extractDocumentationEvidence(markdown.replace('continue safely', 'continue deliberately'), knownKeys, limits);

    expect(after.fingerprints.workflow.auto_advance).not.toBe(before.fingerprints.workflow.auto_advance);
    expect(after.fingerprints.model_profile).toBe(before.fingerprints.model_profile);
  });

  it('rejects bounded source, heading, and section breaches', () => {
    expect(() => extractDocumentationEvidence(markdown, knownKeys, { ...limits, maxSourceBytes: 1 })).toThrow();
    expect(() => extractDocumentationEvidence(markdown, knownKeys, { ...limits, maxHeadings: 1 })).toThrow();
    expect(() => extractDocumentationEvidence(markdown, knownKeys, { ...limits, maxSectionBytes: 1 })).toThrow();
  });
});
