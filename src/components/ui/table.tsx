"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * `maxH` mengubah wrapper jadi kotak scroll vertikal dengan tinggi terbatas.
 *
 * Kenapa prop ini ada, dan kenapa halaman pendek TIDAK memakainya:
 *
 * `overflow-x: auto` dengan `overflow-y: visible` membuat `overflow-y` dihitung
 * menjadi `auto` (CSS Overflow 3). Jadi wrapper ini adalah scroll container di
 * KEDUA sumbu. Akibatnya `position: sticky; top: 0` pada `<th>` akan lengket ke
 * wrapper — bukan ke halaman — dan karena wrapper tanpa `max-h` tidak pernah
 * scroll vertikal, sticky-nya SEPANUHNYA tidak terlihat efeknya.
 *
 * Jadi menempelkan `sticky top-0` pada `TableHead` saja menghasilkan perubahan
 * yang terlihat benar di diff dan diam-diam tidak berfungsi. Memberi `max-h`
 * membuat wrapper benar-benar punya tinggi scrollable, dan sticky baru bekerja.
 *
 * Tidak semua tabel butuh ini. Daftar 10 toko atau 26 karyawan muat tanpa
 * terpotong — menambah `max-h` di sana hanya memunculkan scrollbar kedua tanpa
 * manfaat. Pakai pada halaman yang barisnya memang banyak.
 *
 * Aksesibilitas: `tabIndex` + `role="region"` + `aria-label` memberi jalan
 * bagi pembaca layar untuk menggulir area ini di luar cara keyboard biasa.
 */
function Table({
  className,
  maxH,
  scrollLabel,
  ...props
}: React.ComponentProps<"table"> & {
  /** Tinggi maksimum wrapper, mis. "70vh". Tanpa ini wrapper tumbuh setinggi isinya. */
  maxH?: string;
  /** Wajib diisi bersama maxH — memberi nama area scroll untuk pembaca layar. */
  scrollLabel?: string;
}) {
  return (
    <div
      data-slot="table-container"
      className={cn("relative w-full overflow-x-auto", maxH && "overflow-y-auto")}
      style={maxH ? { maxHeight: maxH } : undefined}
      tabIndex={maxH ? 0 : undefined}
      role={maxH ? "region" : undefined}
      aria-label={maxH ? scrollLabel : undefined}
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

/**
 * Varian header lengket. Pakai INI — bukan `TableHeader` biasa — kalau tabelnya
 * punya `maxH` di `Table`.
 *
 * Latar `bg-card` wajib: tanpa itu, baris yang lewat di bawah header akan
 * terlihat menembusnya. `border-b` menjaga garis pemisah tetap ada saat
 * header tidak menempel di posisi paling atas.
 */
function TableHeaderSticky({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

/** Sel header lengket. Selalu barengi `TableHeaderSticky`. */
function TableHeadSticky({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "sticky top-0 z-10 h-10 border-b bg-card px-2 text-left align-middle font-medium whitespace-nowrap text-foreground",
        className
      )}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        // Sengaja TIDAK ada `sticky` di sini. Sticky hanya bekerja kalau wrapper
        // `Table` punya `maxH`; tanpa itu header lengket ke wrapper yang tidak
        // pernah scroll, jadi tidak ada efeknya sama sekali. Pakai
        // `TableHeadSticky` untuk tabel yang memang punya maxH.
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableHeaderSticky,
  TableBody,
  TableFooter,
  TableHead,
  TableHeadSticky,
  TableRow,
  TableCell,
  TableCaption,
}
