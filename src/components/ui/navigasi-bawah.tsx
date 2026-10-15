"use client"

/**
 * Navigasi bawah untuk halaman karyawan (K-67, `rules/05` §3b).
 *
 * Presentational murni: komponen ini tidak tahu apa itu absensi, agenda, kamera,
 * atau token. Yang diterimanya hanya daftar item, nilai yang sedang aktif, dan
 * callback saat item dipilih. Label teks dikirim dari luar supaya tidak ada
 * kosakata aplikasi yang tertanam di sini.
 *
 * Yang dijaga di dalam berkas ini, semuanya dari `rules/05` §3b:
 *
 *   - **Label teks selalu ikut.** Ikon tidak boleh jadi satu-satunya pembawa
 *     arti (§1.3), jadi ikon ditandai `aria-hidden` dan nama aksesibel item
 *     diambil dari teksnya, bukan dari ikon.
 *   - **Target sentuh.** Bar 64 px per item — jauh di atas minimum 44×44 px (§2).
 *   - **Safe-area tanpa ruang ganda.** Padding bawah memakai
 *     `env(safe-area-inset-bottom)` dengan sendirian, tanpa tambahan tinggi tetap.
 *     Di perangkat tanpa notch nilainya 0, jadi bar tetap setinggi 64 px.
 *   - **Tab aktif bukan warna saja.** Penanda bentuk (garis di atas item) dan
 *     teks tebal ikut berubah. Warna tetap berubah juga, tapi tidak sendirian.
 *   - **Tumpukan z-index.** `z-40`, satu tingkat di bawah `z-50` milik Dialog,
 *     Sheet, Dropdown, dan Select. Modal hasil foto harus menutupi navigasi,
 *     bukan sebaliknya.
 *
 * Yang SENGAJA tidak ada di sini: tinggi memakai `dvh`. Dimensi ini bukan
 * tinggi viewport, jadi `dvh` tidak relevan — `dvh` dipakai di kerangka halaman
 * (`min-h-dvh` pada `<main>`), yang memang tinggi viewport.
 */
import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * CATATAN TINGGI BAR: tinggi bar di atas safe-area adalah `h-[4rem]` (64 px) di
 * `<button>` bawah. Angka yang sama dipakai lagi untuk padding bawah konten
 * halaman, yaitu `pb-[calc(4rem+env(safe-area-inset-bottom))]` pada `<main>` di
 * `src/app/a/[token]/page.tsx`. Kalau yang satu berubah dan yang lain tidak,
 * navigasi akan menutupi tombol "Absen".
 *
 * Angka itu sengaja ditulis sebagai literal CSS di kedua berkas, bukan
 * diinterpolasi dari satu konstanta: Tailwind memindai TEKS sumber untuk kelas
 * yang harus dibuat, jadi `h-[${TINGGI}]` tidak akan pernah menghasilkan CSS.
 * Yang mengunci keduanya agar tidak melenceng ada di
 * `tests/ui6-navigasi-bawah.test.ts` — tes membandingkan keduanya dari HTML
 * hasil render.
 */

export type ItemNavigasiBawah = {
  /** Nilai yang dikembalikan ke `onPilih` saat item ditekan. */
  nilai: string
  /** Label teks Bahasa Indonesia. Inilah nama aksesibel item. */
  label: string
  Ikon?: LucideIcon
}

function NavigasiBawah({
  label,
  nilai,
  item,
  onPilih,
  className,
}: {
  /** `aria-label` untuk `<nav>` — menandai landmark ini untuk pembaca layar. */
  label: string
  /** Nilai item yang sedang aktif. */
  nilai: string
  item: ItemNavigasiBawah[]
  onPilih: (nilai: string) => void
  className?: string
}) {
  return (
    <nav
      aria-label={label}
      data-slot="navigasi-bawah"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]",
        className,
      )}
    >
      <ul className="mx-auto flex w-full max-w-[480px] items-stretch">
        {item.map((it) => {
          const aktif = it.nilai === nilai
          return (
            <li key={it.nilai} className="flex-1">
              <button
                type="button"
                onClick={() => onPilih(it.nilai)}
                aria-current={aktif ? "page" : undefined}
                data-slot="navigasi-bawah-item"
                data-aktif={aktif ? "ya" : undefined}
                className={cn(
                  "relative flex h-[4rem] w-full flex-col items-center justify-center gap-1 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring",
                  aktif ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {/* Penanda bentuk, bukan hanya warna (rules/05 §3b). */}
                {aktif ? (
                  <span
                    aria-hidden="true"
                    data-slot="navigasi-bawah-penanda"
                    className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-primary"
                  />
                ) : null}
                {it.Ikon ? <it.Ikon className="size-6" aria-hidden="true" /> : null}
                <span className={cn("text-base", aktif ? "font-semibold" : "font-medium")}>
                  {it.label}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export { NavigasiBawah }