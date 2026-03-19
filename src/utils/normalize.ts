/**
 * Shared pure utility functions used by extraction and retrieval services.
 * These have no side-effects and no external dependencies (no LLM, no DB).
 */

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

export const canonicalizeQueryNodeIds = (nodeIds: string[]) => {
  const identified = new Set<string>();

  for (const raw of nodeIds) {
    const normalized = normalizeText(raw);
    identified.add(normalized);

    if (!/^([A-Z]+)_/.test(normalized)) {
      identified.add(`PERSON_${normalized}`);
      identified.add(`ORGANIZATION_${normalized}`);
      identified.add(`CONCEPT_${normalized}`);
      identified.add(`EVENT_${normalized}`);
    }
  }

  return [...identified];
};
