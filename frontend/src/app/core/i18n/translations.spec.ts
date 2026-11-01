import { TRANSLATIONS } from './translations';

describe('translations', () => {
  it('has a non-empty French and Arabic text for every key', () => {
    for (const [key, entry] of Object.entries(TRANSLATIONS)) {
      expect(entry.fr.trim(), `${key} (fr)`).not.toBe('');
      expect(entry.ar.trim(), `${key} (ar)`).not.toBe('');
    }
  });

  it('uses the same {placeholders} in both languages', () => {
    const tokens = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
    for (const [key, entry] of Object.entries(TRANSLATIONS)) {
      expect(tokens(entry.ar), key).toBe(tokens(entry.fr));
    }
  });
});
