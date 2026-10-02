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
  async headers() {
    return [
      {
        source: '/a/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Permissions-Policy', value: 'camera=(self)' },
        ],
      },
    ];
  },
};

export default nextConfig;
