/**
 * UI-2 Pengaturan (§5.9) + Ubah Password (§5.11).
 */
import { describe, expect, it, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

import { CatatanTelegram, PanelPengaturan } from '../src/app/admin/pengaturan/komponen';
import { PanelUbahPassword } from '../src/app/admin/ubah-password/komponen';

const tidakAda = () => {};

function render(node: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(node);
}

/**
 * Elemen polos = tag table/select/input/textarea/button TANPA data-slot.
 * Komponen shadcn me-render tag asli DENGAN data-slot — itu yang benar dan
 * harus lolos. Pola lama `not.toMatch(/<(table|...)`) salah menolak shadcn.
 */
function tagTanpaSlot(html: string): string[] {
  const semua = [...html.matchAll(/<(table|select|input|textarea|button)[^>]*>/g)].map((m) => m[0]);
  return semua.filter((t) => !t.includes('data-slot'));
}

describe('PanelPengaturan (§5.9)', () => {
  it('ambang + nilai bawaan + tombol Simpan dari komponen shadcn', () => {
    const html = render(h(PanelPengaturan, { ambang: '5', onUbahAmbang: tidakAda, onSimpan: tidakAda }));
    expect(html).toContain('Ambang terlambat (menit)');
    expect(html).toContain('for="ambang"');
    expect(html).toContain('value="5"');
    expect(html).toContain('type="number"');
    expect(html).toContain('min="0"');
    expect(html).toContain('Nilai bawaan: 5.');
    expect(html).toContain('>Simpan<');
    expect(html).toContain('data-slot="card"');
    expect(html).toContain('data-slot="input"');
    expect(html).toContain('data-slot="button"');
    expect(html).toContain('data-slot="label"');
  });

  it('catatan Telegram: token tidak ditampilkan', () => {
    const html = render(h(CatatanTelegram));
    expect(html).toContain('variabel lingkungan server');
    expect(html).toContain('tidak ditampilkan');
    expect(html.toLowerCase()).not.toContain('token bot:');
  });

  it('tidak ada elemen polos button/input/select/table/textarea', () => {
    const html = render(h(PanelPengaturan, { ambang: '7', onUbahAmbang: tidakAda, onSimpan: tidakAda }));
    expect(tagTanpaSlot(html)).toEqual([]);
  });
});

describe('PanelUbahPassword (§5.11)', () => {
  it('tiga input bernama persis seperti yang dibaca route + minLength K-48', () => {
    const html = render(h(PanelUbahPassword, { mengirim: false, galat: null, sukses: false, onKirim: tidakAda }));
    for (const name of ['passwordSaatIni', 'passwordBaru', 'konfirmasi']) {
      expect(html, `input ${name}`).toContain(`name="${name}"`);
    }
    expect(html.match(/minLength="8"/g) ?? []).toHaveLength(2);
    expect(html).toContain('Minimal 8 karakter.');
    expect(html).toContain('Ubah Password');
    expect(html).toContain('seluruh sesi akun ini berakhir');
  });

  it('memakai Card + Input + Label + Button shadcn', () => {
    const html = render(h(PanelUbahPassword, { mengirim: false, galat: null, sukses: false, onKirim: tidakAda }));
    expect(html).toContain('data-slot="card"');
    expect((html.match(/data-slot="input"/g) ?? []).length).toBe(3);
    expect((html.match(/data-slot="label"/g) ?? []).length).toBe(3);
    expect(html).toContain('data-slot="button"');
  });

  it('galat memakai Alert destructive, sukses memakai status hijau', () => {
    const galat = render(h(PanelUbahPassword, { mengirim: false, galat: 'Password saat ini salah.', sukses: false, onKirim: tidakAda }));
    expect(galat).toContain('Password saat ini salah.');
    expect(galat).toContain('data-slot="alert"');
    const sukses = render(h(PanelUbahPassword, { mengirim: false, galat: null, sukses: true, onKirim: tidakAda }));
    expect(sukses).toContain('Password berhasil diubah. Silakan masuk kembali.');
    expect(sukses).toContain('role="status"');
    expect(sukses).not.toContain('name="passwordBaru"');
  });

  it('tombol nonaktif saat mengirim dengan atribut disabled', () => {
    const html = render(h(PanelUbahPassword, { mengirim: true, galat: null, sukses: false, onKirim: tidakAda }));
    expect(html).toContain('Mengirim…');
    expect(html).toMatch(/<button[^>]*\sdisabled=""/);
  });

  it('tidak ada elemen polos', () => {
    const html = render(h(PanelUbahPassword, { mengirim: false, galat: null, sukses: false, onKirim: tidakAda }));
    expect(tagTanpaSlot(html)).toEqual([]);
  });
});
