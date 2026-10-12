/**
 * M9 hardening — header keamanan (rules/03 §9.7).
 *
 * Memanggil fungsi `headers()` sungguhan dari next.config.mjs lalu memeriksa
 * hasilnya, bukan membaca teks berkas. BUKTI: hapus satu header dari config,
 * tes ini gagal.
 */
import { describe, it, expect, afterEach } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import nextConfigDefault from '../next.config.mjs';

interface AturanHeader {
  source: string;
  headers: { key: string; value: string }[];
}

const konfigurasi = nextConfigDefault as unknown as {
  headers: () => Promise<AturanHeader[]>;
};

describe('header keamanan next.config.mjs', () => {
  it('admin punya nosniff + referrer + frame + CSP', async () => {
    const semua = await konfigurasi.headers();
    const admin = semua.find((a) => a.source === '/admin/:path*');
    expect(admin, 'aturan /admin/:path* harus ada').toBeDefined();
    const peta = new Map(admin!.headers.map((h) => [h.key, h.value]));
    expect(peta.get('X-Content-Type-Options')).toBe('nosniff');
    expect(peta.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(peta.get('X-Frame-Options')).toBe('DENY');
    const csp = peta.get('Content-Security-Policy') ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
  });

  it('/a/:path* tetap tanpa CSP dan izin kamera utuh', async () => {
    const semua = await konfigurasi.headers();
    const karyawan = semua.find((a) => a.source === '/a/:path*');
    expect(karyawan, 'aturan /a/:path* harus ada').toBeDefined();
    const peta = new Map(karyawan!.headers.map((h) => [h.key, h.value]));
    expect(peta.get('Permissions-Policy')).toBe('camera=(self)');
    expect(peta.get('X-Content-Type-Options')).toBe('nosniff');
    // Satu direktif CSP yang salah mematikan kamera 26 karyawan — jadi /a
    // SENGAJA tanpa CSP. Kalau suatu saat ditambah, harus mengizinkan kamera.
    expect(peta.has('Content-Security-Policy')).toBe(false);
  });
});

describe('M10 header / dan /login (M10-01)', () => {
  for (const sumber of ['/', '/login']) {
    it(`${sumber} punya keempat header dengan CSP paling ketat`, async () => {
      const semua = await konfigurasi.headers();
      const aturan = semua.find((a) => a.source === sumber);
      expect(aturan, `aturan ${sumber} harus ada`).toBeDefined();
      const peta = new Map(aturan!.headers.map((h) => [h.key, h.value]));
      expect(peta.get('X-Content-Type-Options')).toBe('nosniff');
      expect(peta.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(peta.get('X-Frame-Options')).toBe('DENY');
      const csp = peta.get('Content-Security-Policy') ?? '';
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("form-action 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
    });
  }

  it('/login tetap mengizinkan inline script (tanpa itu hidrasi mati)', async () => {
    // /login komponen klien + 3 <script> inline Next tanpa nonce di HTML
    // produksi. Tanpa 'unsafe-inline', form tak pernah mencegat submit.
    const semua = await konfigurasi.headers();
    const csp = new Map(semua.find((a) => a.source === '/login')!.headers.map((h) => [h.key, h.value])).get(
      'Content-Security-Policy',
    )!;
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
  });
});

describe('M10 CSP tanpa unsafe-eval di produksi (M10-02)', () => {
  const env = process.env as Record<string, string | undefined>;
  const NODE_ENV_LAMA = env['NODE_ENV'];

  afterEach(() => {
    env['NODE_ENV'] = NODE_ENV_LAMA;
  });

  function cspUntuk(sumber: string, nodeEnv: string): Promise<string> {
    env['NODE_ENV'] = nodeEnv;
    return konfigurasi.headers().then((semua) => {
      const peta = new Map(semua.find((a) => a.source === sumber)!.headers.map((h) => [h.key, h.value]));
      return peta.get('Content-Security-Policy') ?? '';
    });
  }

  it('produksi: admin dan login TANPA unsafe-eval', async () => {
    expect(await cspUntuk('/admin/:path*', 'production')).not.toContain('unsafe-eval');
    expect(await cspUntuk('/login', 'production')).not.toContain('unsafe-eval');
  });

  it('development: admin dan login MASIH memakai unsafe-eval (HMR)', async () => {
    expect(await cspUntuk('/admin/:path*', 'development')).toContain('unsafe-eval');
    expect(await cspUntuk('/login', 'development')).toContain('unsafe-eval');
  });
});

/**
 * BUG-CSP-01 (B-21). `/` dan `/login` tidak punya style-src/img-src/font-src/
 * connect-src, jadi semuanya jatuh ke `default-src 'self'` dan setiap atribut
 * `style="..."` diblokir. Satu sebab untuk dua gejala sekaligus: React
 * melaporkan hydration mismatch tepat di <main style={...}> (src/app/page.tsx),
 * dan logo dev-tools Next.js tidak muncul sama sekali.
 *
 * Perbaikannya hanya berlaku di development. Tes di bawah mengunci KEDUA sisi:
 * kalau hanya menguji sisi development, kelonggaran yang tidak sengaja ikut ke
 * produksi tidak akan pernah gagal.
 */
describe('BUG-CSP-01: style-src hanya di development', () => {
  const env = process.env as Record<string, string | undefined>;
  const NODE_ENV_LAMA = env['NODE_ENV'];

  afterEach(() => {
    env['NODE_ENV'] = NODE_ENV_LAMA;
  });

  function cspUntuk(sumber: string, nodeEnv: string): Promise<string> {
    env['NODE_ENV'] = nodeEnv;
    return konfigurasi.headers().then((semua) => {
      const peta = new Map(semua.find((a) => a.source === sumber)!.headers.map((h) => [h.key, h.value]));
      return peta.get('Content-Security-Policy') ?? '';
    });
  }

  for (const sumber of ['/', '/login']) {
    it(`development: ${sumber} mengizinkan style inline (tanpa itu <main style> diblokir)`, async () => {
      const csp = await cspUntuk(sumber, 'development');
      expect(csp).toContain("style-src 'self' 'unsafe-inline'");
      // Logo dev-tools Next.js memakai SVG data: URI — tanpa ini tetap tak terlihat.
      expect(csp).toContain("img-src 'self' data: blob:");
    });

    it(`produksi: ${sumber} TETAP ketat — style-src tidak ikut dilonggarkan`, async () => {
      const csp = await cspUntuk(sumber, 'production');
      expect(csp).not.toContain('style-src');
      expect(csp).not.toContain('img-src');
      expect(csp).toContain("object-src 'none'");
    });
  }

  it('development: /a/:path* tetap TANPA CSP — kamera 26 karyawan', async () => {
    env['NODE_ENV'] = 'development';
    const semua = await konfigurasi.headers();
    const karyawan = semua.find((a) => a.source === '/a/:path*')!;
    const peta = new Map(karyawan.headers.map((h) => [h.key, h.value]));
    expect(peta.has('Content-Security-Policy')).toBe(false);
    expect(peta.get('Permissions-Policy')).toBe('camera=(self)');
  });
});
