import { describe, it, expect } from 'vitest';
import { chunkText } from '../utils/chunker';

describe('chunkText', () => {
  it('returns a single chunk for short text', async () => {
    const chunks = await chunkText('Hello world.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe('Hello world.');
  });

  it('splits long text into multiple chunks', async () => {
    // Create a string longer than chunkSize (500 chars)
    const longText = 'word '.repeat(200); // 1000 chars
    const chunks = await chunkText(longText);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('each chunk is at most ~500 characters', async () => {
    const longText = 'word '.repeat(200);
    const chunks = await chunkText(longText);
    for (const chunk of chunks) {
      // Allow some tolerance since the splitter tries to split at natural boundaries
      expect(chunk.length).toBeLessThanOrEqual(550);
    }
  });

  it('preserves all content across chunks', async () => {
    const text = 'Alpha. Bravo. Charlie. Delta. Echo.';
    const chunks = await chunkText(text);
    const reassembled = chunks.join(' ');
    expect(reassembled).toContain('Alpha');
    expect(reassembled).toContain('Echo');
  });

  it('returns empty array for empty string', async () => {
    const chunks = await chunkText('');
    expect(chunks).toHaveLength(0);
  });
});
