/**
 * Integrasi Telegram Bot API (M3).
 *
 * Pola sesuai dokumentasi resmi https://core.telegram.org/bots/api :
 * - request ke https://api.telegram.org/bot<token>/METODE (GET/POST),
 * - upload file memakai multipart/form-data,
 * - respons JSON { ok: true, result: ... }.
 * Multipart dibangun dari FormData + Blob NATIVE Node 24 (undici) —
 * tanpa dependensi tambahan.
 *
 * Token bot TIDAK BOLEH masuk log, URL klien, atau audit. Fungsi ini tidak
 * me-log apa pun; pemanggil (route) wajib menjaga hal yang sama.
 * JANGAN panggil Telegram sungguhan di tes — stub fetch global (vi.stubGlobal).
 */

export interface HasilKirimFoto {
  fileId: string;
  chatId: string;
  messageId: number;
}

interface PesanTelegram {
  message_id: number;
  chat: { id: number | string };
  photo?: { file_id: string }[];
}

function bacaEnv(): { token: string; chatId: string } {
  const token = process.env['TELEGRAM_BOT_TOKEN'] || '';
  const chatId = process.env['TELEGRAM_CHAT_ID'] || '';
  if (!token || !chatId) throw new Error('Konfigurasi Telegram belum lengkap.');
  return { token, chatId };
}

async function bacaHasilTelegram(res: Response, aksi: string): Promise<unknown> {
  let badan: { ok?: boolean; description?: string; result?: unknown; parameters?: { retry_after?: number } };
  try {
    badan = (await res.json()) as typeof badan;
  } catch {
    throw new Error(`Telegram tidak merespons ${aksi}.`);
  }
  if (!res.ok || badan.ok !== true) {
    const tunggu = badan.parameters?.retry_after;
    const sebab = typeof tunggu === 'number' ? ` Coba lagi setelah ${tunggu} detik.` : '';
    throw new Error(`Telegram menolak ${aksi}.${sebab}`);
  }
  return badan.result;
}

/**
 * Mengirim foto ke grup via sendPhoto (multipart). Mengambil file_id ukuran
 * TERBESAR (elemen terakhir array photo). Caption berisi nama, toko, jenis,
 * waktu WIB, dan request_id untuk penelusuran (rules/03 §7).
 */
export async function kirimFotoKeTelegram(foto: Buffer, caption: string): Promise<HasilKirimFoto> {
  const { token, chatId } = bacaEnv();
  const form = new FormData();
  form.set('chat_id', chatId);
  form.set('photo', new Blob([new Uint8Array(foto)], { type: 'image/jpeg' }), 'absen.jpg');
  form.set('caption', caption);

  let res: Response;
  try {
    res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new Error('Telegram tidak merespons pengiriman foto.');
  }
  const hasil = (await bacaHasilTelegram(res, 'pengiriman foto')) as PesanTelegram;
  const daftar = hasil.photo ?? [];
  const terbesar = daftar[daftar.length - 1];
  if (typeof hasil.message_id !== 'number' || !terbesar) {
    throw new Error('Respons Telegram tidak memuat foto.');
  }
  return { fileId: terbesar.file_id, chatId: String(hasil.chat.id), messageId: hasil.message_id };
}

/**
 * Mengunduh file via getFile + server unduhan Telegram — untuk proxy foto
 * admin. URL unduhan mengandung token bot sehingga TIDAK BOLEH diberikan
 * ke klien; kembalikan isi bytes-nya saja.
 */
export async function unduhFotoTelegram(fileId: string): Promise<Buffer> {
  const { token } = bacaEnv();
  let info: Response;
  try {
    info = await fetch(`https://api.telegram.org/bot${token}/getFile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new Error('Telegram tidak merespons permintaan file.');
  }
  const hasil = (await bacaHasilTelegram(info, 'permintaan file')) as { file_path?: string };
  if (!hasil.file_path) throw new Error('Respons Telegram tidak memuat jalur file.');

  let unduh: Response;
  try {
    // file_path berasal dari server Telegram; token ditambah oleh kode ini.
    const url = `https://api.telegram.org/file/bot${token}/${hasil.file_path}`;
    unduh = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  } catch {
    throw new Error('Unduhan foto dari Telegram gagal.');
  }
  if (!unduh.ok) throw new Error('Unduhan foto dari Telegram gagal.');
  return Buffer.from(await unduh.arrayBuffer());
}
