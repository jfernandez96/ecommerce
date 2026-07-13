"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { ProductCard } from "@/components/commerce/product-card";
import { useWishlistStore } from "@/store/wishlist-store";
import { useEffect, useState } from "react";

export default function WishlistPage() {
  const { items } = useWishlistStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const convertedProducts = items.map((item) => ({
    id: item.productId,
    name: item.name,
    slug: item.slug,
    brand: item.brand,
    category: "Favoritos",
    regularPrice: item.regularPrice,
    salePrice: item.salePrice,
    stock: 99,
    size: item.size,
    imageUrl: item.image,
    rating: 4.5,
    isOnSale: !!item.salePrice,
    sizesCsv: item.sizesCsv,
    distinctColorCount: item.distinctColorCount,
    distinctSizeCount: item.distinctSizeCount,
  }));

  return (
    <main className="min-h-screen">
      <section className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Heart className="h-8 w-8 fill-accent text-accent" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Tus Favoritos</h1>
              <p className="mt-1 text-sm text-foreground/60">Productos que guardaste para comprar después</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Heart className="h-16 w-16 text-foreground/20 mb-4" />
            <h2 className="text-xl font-semibold text-foreground/80">No tienes favoritos aún</h2>
            <p className="mt-2 text-foreground/60">
              Haz click en el corazón en los productos que te gusten para agregarlos aquí
            </p>
            <Link
              href="/collections"
              className="mt-6 inline-flex h-11 items-center rounded-full bg-accent px-7 text-sm font-semibold text-white transition hover:bg-accent/90"
            >
              Ver productos
            </Link>
          </div>
        ) : (
          <div>
            <p className="mb-8 text-sm text-foreground/60">{items.length} producto{items.length !== 1 ? "s" : ""} guardado{items.length !== 1 ? "s" : ""}</p>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {convertedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
