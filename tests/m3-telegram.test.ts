import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { kirimFotoKeTelegram, unduhFotoTelegram } from '../src/server/telegram';

const TOKEN_RAHASIA = 'R4HASIA-BOT-TOKEN-UNTUK-TES';

function responsJson(badan: unknown, status = 200): Response {
  return new Response(JSON.stringify(badan), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('telegram — kirim foto (stub fetch, tanpa grup sungguhan)', () => {
  beforeEach(() => {
    process.env['TELEGRAM_BOT_TOKEN'] = TOKEN_RAHASIA;
    process.env['TELEGRAM_CHAT_ID'] = '-100999';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env['TELEGRAM_BOT_TOKEN'];
    delete process.env['TELEGRAM_CHAT_ID'];
  });

  it('mengambil file_id ukuran TERBESAR (elemen terakhir photo)', async () => {
    let urlDipanggil = '';
    let bodyDipakai: FormData | null = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        urlDipanggil = url;
        bodyDipakai = init?.body as FormData;
        return responsJson({
          ok: true,
          result: {
            message_id: 42,
            chat: { id: -100999 },
            photo: [{ file_id: 'kecil' }, { file_id: 'sedang' }, { file_id: 'TERBESAR' }],
          },
        });
      }),
    );
    const hasil = await kirimFotoKeTelegram(Buffer.from([1, 2, 3]), 'nama · toko · CHECKIN · waktu · req-1');
    expect(hasil).toEqual({ fileId: 'TERBESAR', chatId: '-100999', messageId: 42 });
    expect(urlDipanggil).toBe(`https://api.telegram.org/bot${TOKEN_RAHASIA}/sendPhoto`);
    // Terkirim sebagai multipart dengan field yang benar.
    expect(bodyDipakai).toBeInstanceOf(FormData);
    expect(bodyDipakai!.get('chat_id')).toBe('-100999');
    expect(bodyDipakai!.get('caption')).toContain('req-1');
  });

  it('Telegram menolak (ok:false) -> error tanpa token di pesan', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => responsJson({ ok: false, description: 'Bad Request' }, 400)));
    await expect(kirimFotoKeTelegram(Buffer.from([1]), 'x')).rejects.toThrow('Telegram menolak pengiriman foto.');
    await kirimFotoKeTelegram(Buffer.from([1]), 'x').catch((e: Error) => {
      expect(e.message).not.toContain(TOKEN_RAHASIA);
    });
  });

  it('jaringan gagal -> error pengiriman', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('socket hang up');
      }),
    );
    await expect(kirimFotoKeTelegram(Buffer.from([1]), 'x')).rejects.toThrow('tidak merespons');
  });

  it('tanpa photo di respons -> error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => responsJson({ ok: true, result: { message_id: 1, chat: { id: 1 } } })));
    await expect(kirimFotoKeTelegram(Buffer.from([1]), 'x')).rejects.toThrow('tidak memuat foto');
  });

  it('env belum diset -> error konfigurasi (tanpa memuat token)', async () => {
    delete process.env['TELEGRAM_BOT_TOKEN'];
    const panggil = vi.fn(async () => responsJson({ ok: true, result: {} }));
    vi.stubGlobal('fetch', panggil);
    await expect(kirimFotoKeTelegram(Buffer.from([1]), 'x')).rejects.toThrow('belum lengkap');
    expect(panggil).not.toHaveBeenCalled();
  });
});

describe('telegram — unduh foto untuk proxy', () => {
  beforeEach(() => {
    process.env['TELEGRAM_BOT_TOKEN'] = TOKEN_RAHASIA;
    process.env['TELEGRAM_CHAT_ID'] = '-100999';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env['TELEGRAM_BOT_TOKEN'];
    delete process.env['TELEGRAM_CHAT_ID'];
  });

  it('getFile lalu unduh bytes — URL unduh hanya dipakai di server', async () => {
    const urlDipanggil: string[] = [];
    const isi = new Uint8Array([10, 20, 30]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urlDipanggil.push(url);
        if (url.endsWith('/getFile')) return responsJson({ ok: true, result: { file_id: 'ABC', file_path: 'photos/foto.jpg' } });
        return new Response(isi, { status: 200 });
      }),
    );
    const hasil = await unduhFotoTelegram('ABC');
    expect(Buffer.compare(hasil, Buffer.from(isi))).toBe(0);
    // URL unduhan (yang mengandung token) dipakai di server, tak dikembalikan.
    expect(urlDipanggil[1]).toBe(`https://api.telegram.org/file/bot${TOKEN_RAHASIA}/photos/foto.jpg`);
  });

  it('getFile tanpa file_path -> error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => responsJson({ ok: true, result: {} })));
    await expect(unduhFotoTelegram('ABC')).rejects.toThrow('tidak memuat jalur file');
  });
});
