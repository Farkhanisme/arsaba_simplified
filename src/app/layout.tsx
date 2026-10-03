import './globals.css';

export const metadata = {
  title: 'Arsaba Management Center',
};

// Skrip inline kecil: memasang kelas `dark` ke <html> SEBELUM hydrate supaya
// tidak ada kedipan putih. Membaca localStorage dulu, lalu prefers-color-scheme.
const SKRIP_TEMA = `(function(){try{var s=localStorage.getItem('arsaba-tema');var g=s?s==='gelap':window.matchMedia('(prefers-color-scheme: dark)').matches;if(g)document.documentElement.classList.add('dark')}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SKRIP_TEMA }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
