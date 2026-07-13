"use client";

import Link from "next/link";
import { ShoppingBag, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveMediaUrl } from "@/lib/media-url";
import { QuantityStepper } from "@/components/commerce/quantity-stepper";
import { formatCurrency } from "@/lib/utils";
import { useCartStore } from "@/store/cart-store";

export function CartDrawer() {
  const { items, isDrawerOpen, closeDrawer, changeQuantity, removeItem } = useCartStore();

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/35 transition ${isDrawerOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={closeDrawer}
        aria-hidden="true"
      />
      <aside className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-[520px] flex-col bg-background shadow-2xl transition-transform duration-300 ${isDrawerOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <h2 className="text-2xl font-black">Carrito de compra ({items.length})</h2>
          <button type="button" onClick={closeDrawer} className="grid h-10 w-10 place-items-center rounded-full hover:bg-muted" aria-label="Cerrar carrito">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-foreground/60">
              Tu carrito aun esta vacio.
            </div>
          ) : (
            <div className="space-y-6">
              {items.map((item) => (
                <article key={item.lineId} className="grid grid-cols-[88px_minmax(0,1fr)_auto] gap-4 border-b border-border pb-6">
                  <div className="h-24 w-24 rounded-2xl bg-cover bg-center" style={{ backgroundImage: `url(${resolveMediaUrl(item.imageUrl)})` }} />
                  <div>
                    <h3 className="line-clamp-2 text-lg font-semibold">{item.name}</h3>
                    <p className="text-sm text-foreground/60">{[item.selectedColor, item.selectedSize].filter(Boolean).join(" / ") || "Configuracion general"}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xl font-bold text-accent">{formatCurrency(item.unitPrice)}</span>
                      {item.compareAtPrice && <span className="text-sm text-foreground/45 line-through">{formatCurrency(item.compareAtPrice)}</span>}
                    </div>
                    <div className="mt-3">
                      <QuantityStepper value={item.quantity} max={item.maxAvailableStock} onChange={(value) => changeQuantity(item.lineId, value)} />
                    </div>
                  </div>
                  <div className="flex flex-col items-end justify-between gap-3">
                    <p className="text-right text-sm text-foreground/55">Subtotal</p>
                    <p className="text-xl font-black">{formatCurrency(item.unitPrice * item.quantity)}</p>
                    <button type="button" onClick={() => removeItem(item.lineId)} className="rounded-full p-2 text-foreground/50 hover:bg-muted" aria-label="Eliminar producto del carrito">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border px-6 py-5">
          <div className="mb-5 flex items-center justify-between text-2xl font-black">
            <span>Total parcial</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="grid gap-3">
            <Link href="/cart" onClick={closeDrawer}>
              <Button variant="secondary" className="w-full">Ver carrito</Button>
            </Link>
            <Link href="/checkout" onClick={closeDrawer}>
              <Button className="w-full"><ShoppingBag size={18} /> Finalizar compra</Button>
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}