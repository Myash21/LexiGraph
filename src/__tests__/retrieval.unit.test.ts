import { describe, it, expect } from 'vitest';
import { canonicalizeQueryNodeIds } from '../utils/normalize';

describe('canonicalizeQueryNodeIds', () => {
  it('normalizes a bare name and adds type-prefixed variants', () => {
    const result = canonicalizeQueryNodeIds(['alice']);
    expect(result).toContain('ALICE');
    expect(result).toContain('PERSON_ALICE');
    expect(result).toContain('ORGANIZATION_ALICE');
    expect(result).toContain('CONCEPT_ALICE');
    expect(result).toContain('EVENT_ALICE');
  });

  it('does NOT add type-prefixed variants when id already has a canonical prefix', () => {
    const result = canonicalizeQueryNodeIds(['PERSON_Alice']);
    expect(result).toContain('PERSON_ALICE');
    // Should not generate PERSON_PERSON_ALICE etc.
    expect(result).not.toContain('PERSON_PERSON_ALICE');
  });

  it('handles multiple node ids', () => {
    const result = canonicalizeQueryNodeIds(['alice', 'PERSON_Bob']);
    expect(result).toContain('ALICE');
    expect(result).toContain('PERSON_ALICE');
    expect(result).toContain('PERSON_BOB');
  });

  it('deduplicates results', () => {
    const result = canonicalizeQueryNodeIds(['alice', 'alice']);
    const aliceCount = result.filter(r => r === 'ALICE').length;
    expect(aliceCount).toBe(1);
  });

  it('returns empty array for empty input', () => {
    expect(canonicalizeQueryNodeIds([])).toEqual([]);
  });
});
