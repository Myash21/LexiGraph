import { describe, it, expect } from 'vitest';
import { normalizeText, canonicalizeNodeId } from '../utils/normalize';

describe('normalizeText', () => {
  it('uppercases and replaces non-alphanumeric chars with underscores', () => {
    expect(normalizeText('hello world')).toBe('HELLO_WORLD');
  });

  it('trims whitespace', () => {
    expect(normalizeText('  foo  ')).toBe('FOO');
  });

  it('strips leading and trailing underscores', () => {
    expect(normalizeText('--hello--')).toBe('HELLO');
  });

  it('handles special characters', () => {
    expect(normalizeText('Elon Musk (CEO)')).toBe('ELON_MUSK_CEO');
  });

  it('preserves numbers', () => {
    expect(normalizeText('gpt-4o')).toBe('GPT_4O');
  });

  it('collapses consecutive special chars into single underscore', () => {
    expect(normalizeText('a---b___c')).toBe('A_B_C');
  });
});

describe('canonicalizeNodeId', () => {
  it('returns normalized id when it already has a canonical prefix', () => {
    expect(canonicalizeNodeId('PERSON_Alice')).toBe('PERSON_ALICE');
  });

  it('prepends type when id lacks a canonical prefix', () => {
    expect(canonicalizeNodeId('alice', 'Person')).toBe('PERSON_ALICE');
  });

  it('returns just normalized id when no prefix and no type given', () => {
    expect(canonicalizeNodeId('alice')).toBe('ALICE');
  });

  it('returns falsy id as-is', () => {
    expect(canonicalizeNodeId('')).toBe('');
  });

  it('handles id that normalizes to look like a prefixed id', () => {
    // 'open ai' normalizes to 'OPEN_AI', which the regex sees as already having a prefix ('OPEN_')
    expect(canonicalizeNodeId('open ai', 'Organization')).toBe('OPEN_AI');
  });

  it('prepends type when normalized id has no underscore prefix', () => {
    expect(canonicalizeNodeId('tesla', 'Organization')).toBe('ORGANIZATION_TESLA');
  });
});
