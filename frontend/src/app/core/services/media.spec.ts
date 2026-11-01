import { mediaUrl } from './media';

describe('mediaUrl', () => {
  it('accepts uploaded media and https URLs', () => {
    expect(mediaUrl('/media/a.webp')).toContain('/media/a.webp');
    expect(mediaUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
  });

  it('never renders dangerous or insecure URLs', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'http://insecure.example/a.png', '//evil.example/a.png', '', null, undefined]) {
      expect(mediaUrl(bad as string | null | undefined)).toBeNull();
    }
  });
});
