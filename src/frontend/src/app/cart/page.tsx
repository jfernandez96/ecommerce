"use client";

import Link from "next/link";
import { ArrowLeft, ShieldCheck, Trash2, Truck } from "lucide-react";
import { ProductImage } from "@/components/commerce/product-image";
import { QuantityStepper } from "@/components/commerce/quantity-stepper";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { useCartStore } from "@/store/cart-store";

export default function CartPage() {
  const { items, changeQuantity, removeItem } = useCartStore();
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const shipping = subtotal >= 250 || items.length === 0 ? 0 : 18;
  const total = subtotal + shipping;

  return (
    <main className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-[1.1fr_420px]">
      <section>
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-foreground/60 transition hover:text-foreground">
          <ArrowLeft size={16} /> Seguir comprando
        </Link>
        <h1 className="mt-4 text-4xl font-black">Tu carrito</h1>
        <p className="mt-2 text-foreground/60">Revisa tus prendas seleccionadas antes de continuar con un pago seguro.</p>

        <div className="mt-8 space-y-5">
          {items.map((item) => (
            <article key={item.lineId} className="grid gap-5 rounded-[28px] border border-border bg-background p-5 shadow-sm sm:grid-cols-[140px_minmax(0,1fr)_auto]">
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-muted">
                <ProductImage src={item.imageUrl} alt={item.name} fill sizes="140px" className="object-cover" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-foreground/45">{item.brand}</p>
                <h2 className="mt-2 text-xl font-bold">{item.name}</h2>
                <p className="mt-2 text-sm text-foreground/60">{[item.selectedColor, item.selectedSize].filter(Boolean).join(" / ") || "Configuracion general"}</p>
                <div className="mt-4 flex items-center gap-3">
                  <span className="text-2xl font-black">{formatCurrency(item.unitPrice)}</span>
                  {item.compareAtPrice && <span className="text-sm text-foreground/45 line-through">{formatCurrency(item.compareAtPrice)}</span>}
                </div>
                <div className="mt-5">
                  <QuantityStepper value={item.quantity} max={item.maxAvailableStock} onChange={(value) => changeQuantity(item.lineId, value)} />
                </div>
              </div>
              <div className="flex flex-col items-end justify-between gap-4">
                <button type="button" onClick={() => removeItem(item.lineId)} className="rounded-full p-3 text-foreground/55 transition hover:bg-muted" aria-label="Eliminar producto">
                  <Trash2 size={18} />
                </button>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.24em] text-foreground/45">Subtotal</p>
                  <p className="mt-1 text-xl font-black">{formatCurrency(item.unitPrice * item.quantity)}</p>
                </div>
              </div>
            </article>
          ))}

          {items.length === 0 && <p className="rounded-[28px] border border-dashed border-border p-10 text-center text-foreground/60">Tu carrito esta vacio. Explora el catalogo y agrega tus productos favoritos.</p>}
        </div>
      </section>

      <aside className="h-fit rounded-[32px] border border-border bg-muted/30 p-6">
        <h2 className="text-2xl font-black">Resumen del pedido</h2>
        <div className="mt-6 space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-foreground/60">Subtotal</span>
            <strong>{formatCurrency(subtotal)}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-foreground/60">Envio</span>
            <strong>{shipping === 0 ? "Gratis" : formatCurrency(shipping)}</strong>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-4 text-lg">
            <span className="font-semibold">Total</span>
            <strong className="text-2xl font-black">{formatCurrency(total)}</strong>
          </div>
        </div>

        <div className="mt-6 grid gap-3">
          <Link href="/checkout">
            <Button className="w-full" disabled={items.length === 0}>Finalizar compra</Button>
          </Link>
          <div className="rounded-2xl border border-border bg-background p-4 text-sm text-foreground/65">
            <div className="flex items-center gap-2 font-semibold text-foreground"><ShieldCheck size={18} /> Pago protegido</div>
            <p className="mt-2">La integracion de tarjeta y Yape se prepara desde servidor para no exponer credenciales ni datos sensibles en el navegador.</p>
          </div>
          <div className="rounded-2xl border border-border bg-background p-4 text-sm text-foreground/65">
            <div className="flex items-center gap-2 font-semibold text-foreground"><Truck size={18} /> Envio premium</div>
            <p className="mt-2">Obtienes envio gratis superando S/ 250. El costo se recalcula en checkout segun tu direccion.</p>
          </div>
        </div>
      </aside>
    </main>
  );
}