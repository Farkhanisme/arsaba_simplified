import { createClient, Client, Transaction } from '@libsql/client';

let client: Client | null = null;

export function getDb(): Client {
  if (!client) {
    const url = process.env['TURSO_DATABASE_URL'] || 'file:./data/uji.db';
    const authToken = process.env['TURSO_AUTH_TOKEN'] || '';
    client = createClient({
      url,
      authToken: authToken || undefined,
    });
  }
  return client;
}

export async function denganTransaksi<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  const db = getDb();
  const tx = await db.transaction();
  try {
    const hasil = await fn(tx);
    await tx.commit();
    return hasil;
  } catch (e) {
    await tx.rollback();
    throw e;
  } finally {
    tx.close();
  }
}
