import { describe, it, expect } from 'vitest';

import HalamanAkar from '../src/app/page';

describe('halaman akar tidak berbohong tentang versi', () => {
  it('tidak memuat "versi M0" maupun kata "versi", dan menautkan ke /login', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { createElement } = await import('react');
    const html = renderToStaticMarkup(createElement(HalamanAkar));

    expect(html).not.toContain('versi M0');
    expect(html.toLowerCase()).not.toMatch(/\bversi\b/);
    expect(html).toContain('href="/login"');
    expect(html).toContain('Arsaba Management Center');
  });
});
