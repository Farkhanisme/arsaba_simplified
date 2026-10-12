/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    serverActions: { enabled: false },
  },
  // rules/03 §9.7: header keamanan dasar. Izin kamera untuk origin sendiri
  // memakai Permissions-Policy (mekanisme modern; direktif kamera di CSP
  // sudah usang) — halaman /a/[token] butuh getUserMedia.
  //
  // M9: /admin/:path* mendapat X-Content-Type-Options, Referrer-Policy,
  // X-Frame-Options, dan CSP. Admin tidak memakai kamera, jadi CSP-nya boleh
  // lebih ketat (tanpa media-src/camera). /a/:path* SENGAJA tidak diberi CSP:
  // satu direktif salah akan mematikan kamera 26 karyawan.
  //
  // M10: / dan /login mendapat keempat header dengan CSP paling ketat (tanpa
  // kamera, tanpa grafik). `script-src 'self' 'unsafe-inline'` WAJIB ada di
  // sini walau terlihat longgar: halaman /login adalah komponen klien (fetch
  // + router.push) dan HTML produksinya memuat 3 <script> inline Next.js tanpa
  // nonce. Tanpa 'unsafe-inline', hidrasi mati dan form login tidak pernah
  // mencegat submit — login rusak tanpa error server apa pun. 'unsafe-eval'
  // hanya untuk `next dev` (lihat modeProduksi di bawah).
  //
  // M10: 'unsafe-eval' hanya dikirim saat BUKAN produksi. Dokumentasi resmi
  // Next.js: "'unsafe-eval' is not required for production. Neither React nor
  // Next.js use `eval` in production by default." — sedangkan "In development,
  // you will need to enable 'unsafe-eval'". NODE_ENV dibaca di sini, saat
  // server berjalan (`next dev` = development, `next start` = production),
  // mengikuti pola contoh resmi yang sama (lihat rules/NOTES.md §17).
  //
  // BUG-CSP-01 (lihat rules/OPEN_QUESTIONS.md B-21): `/` dan `/login` TIDAK
  // punya direktif style-src/img-src/font-src/connect-src. Rantai fallback CSP3
  // untuk atribut `style="..."` adalah
  //     style-src-attr  ->  style-src  ->  default-src
  // jadi tanpa style-src, SEMUA atribut style inline diblokir oleh
  // `default-src 'self'`. Akibatnya di `next dev`:
  //   1. src/app/page.tsx:5 <main style={{...}}> diblokir -> React melaporkan
  //      "A tree hydrated but some attributes ... didn't match" tepat di
  //      elemen itu, dan
  //   2. dev-tools overlay Next.js (logo Next.js) tidak terlihat sama sekali:
  //      bundle `next-devtools` menyuntik <style> ke document (terbukti:
  //      `createElement("style")` muncul 3x di chunk itu), dan <style> diatur
  //      oleh rantai style-src yang sama.
  // Perhatikan: penulisan lewat CSSOM (el.style.display = ...) TIDAK diblokir
  // CSP, dan bundle ini juga tidak memakai data: URI sama sekali — yang
  // diblokir hanya <style> yang disuntik dan atribut style="...".
  // `/admin/:path*` sudah sejak awal punya keempat direktif itu, dan halaman
  // admin memang tidak pernah mengalami bug ini — itu pembeda yang memastikan
  // ini soal CSP, bukan soal React.
  //
  // Perbaikan: keempat direktif itu ditambahkan HANYA saat BUKAN produksi,
  // dengan penalaran yang sama seperti 'unsafe-eval' di atas. Byte CSP produksi
  // TIDAK berubah sama sekali. Risiko `style-src 'unsafe-inline'` adalah
  // kebocoran data lewat CSS, yang tidak relevan di sini (CSS aplikasi ini
  // statis, tidak ada input pengguna yang masuk ke selector).
  async headers() {
    const modeProduksi = process.env['NODE_ENV'] === 'production';
    const skripAman = modeProduksi ? "'self' 'unsafe-inline'" : "'self' 'unsafe-inline' 'unsafe-eval'";
    const cspMasuk = [
      "default-src 'self'",
      `script-src ${skripAman}`,
      ...(modeProduksi
        ? []
        : [
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "font-src 'self' data:",
            "connect-src 'self'",
          ]),
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; ');
    return [
      {
        source: '/',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: cspMasuk },
        ],
      },
      {
        source: '/login',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: cspMasuk },
        ],
      },
      {
        source: '/a/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Permissions-Policy', value: 'camera=(self)' },
        ],
      },
      {
        source: '/admin/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src ${skripAman}`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
