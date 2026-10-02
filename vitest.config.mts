import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],

    // WAJIB: file tes tidak boleh berjalan paralel. Setiap file tes memakai database
    // uji sendiri di data/uji_*.db dan menyalakan/menghapus file itu di beforeAll/
    // afterAll. Dengan paralel, dua file saling menimpa database dan saling menghapus
    // file yang sedang dipakai — gejalanya berupa kegagalan yang berbeda-beda tiap
    // kali, bukan error yang jelas. Gejala nyata terjadi 2026-10-02: "Tests 6 failed"
    // dan "18 skipped" saat paralel, padahal semuanya lulus dengan --no-file-parallelism.
    fileParallelism: false,

    // beforeAll menjalankan migrate + seed lewat execSync; default 5 detik terlalu
    // pendek untuk itu di mesin yang lambat.
    hookTimeout: 120_000,
    testTimeout: 60_000,
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
});
