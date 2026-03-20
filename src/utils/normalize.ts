/**
 * Shared pure utility functions used by extraction and retrieval services.
 * These have no side-effects and no external dependencies (no LLM, no DB).
 */

const TYPE_ALIASES: Record<string, string> = {
  COMPANY: 'ORGANIZATION',
  CORP: 'ORGANIZATION',
  FIRM: 'ORGANIZATION',
  INSTITUTION: 'ORGANIZATION',
  HUMAN: 'PERSON',
  INDIVIDUAL: 'PERSON',
  PLACE: 'LOCATION',
  COUNTRY: 'LOCATION',
  CITY: 'LOCATION',
};

const CANONICAL_TYPES = new Set([
  'PERSON', 'ORGANIZATION', 'CONCEPT', 'EVENT', 'LOCATION', 'PRODUCT'
]);

export const normalizeType = (type: string): string => {
  const upper = normalizeText(type);
  return TYPE_ALIASES[upper] ?? (CANONICAL_TYPES.has(upper) ? upper : 'CONCEPT');
};

export const normalizeText = (input: string) =>
  input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

export const canonicalizeNodeId = (id: string, type?: string) => {
  if (!id) return id;

  const normalized = normalizeText(id);
  const hasCanonicalPrefix = /^([A-Z]+)_/.test(normalized);

  if (hasCanonicalPrefix) {
    return normalized;
  }

  if (type) {
    const typeLabel = normalizeText(type);
    return `${typeLabel}_${normalized}`;
  }

  return normalized;
};

export const canonicalizeQueryNodeIds = (nodeIds: string[]): string[] => {
  const identified = new Set<string>();

  for (const raw of nodeIds) {
    const normalized = normalizeText(raw);
    identified.add(normalized); // add as-is first

    // Strip known type prefix to get the bare entity name
    const prefixMatch = normalized.match(/^([A-Z]+)_(.+)$/);
    const bareName = prefixMatch ? prefixMatch[2] : normalized;

    // Expand with all canonical type prefixes
    for (const type of CANONICAL_TYPES) {
      identified.add(`${type}_${bareName}`);
    }
  }

  return [...identified];
};
