export default function LoginPage() {
  return (
    <main style={{ maxWidth: 400, margin: '100px auto', padding: 24, fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>Masuk — Arsaba</h1>
      <form action="/api/login" method="POST" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input name="username" placeholder="Username" required style={{ padding: 12, fontSize: 16 }} />
        <input name="password" type="password" placeholder="Password" required style={{ padding: 12, fontSize: 16 }} />
        <button type="submit" style={{ padding: 12, fontSize: 16 }}>Masuk</button>
      </form>
    </main>
  );
}
