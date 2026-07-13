"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Heart, ShoppingBag, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductImage } from "@/components/commerce/product-image";
import { ProductQuickView } from "@/components/commerce/product-quick-view";
import { formatCurrency } from "@/lib/utils";
import type { ProductSummary, ProductDetail } from "@/lib/api";
import { addToWishlist, getProductBySlug, removeFromWishlist } from "@/lib/api";
import { useCartStore } from "@/store/cart-store";
import { useWishlistStore } from "@/store/wishlist-store";
import { useEffect, useMemo, useState } from "react";

const WISHLIST_GUEST_EMAIL_KEY = "wishlistGuestEmail";

function getWishlistEmail() {
  const userEmail = localStorage.getItem("userEmail")?.trim();
  if (userEmail) return userEmail;

  const savedGuestEmail = localStorage.getItem(WISHLIST_GUEST_EMAIL_KEY)?.trim();
  if (savedGuestEmail) return savedGuestEmail;

  const generatedGuestEmail =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `guest-${crypto.randomUUID()}@guest.local`
      : `guest-${Date.now()}@guest.local`;

  localStorage.setItem(WISHLIST_GUEST_EMAIL_KEY, generatedGuestEmail);
  return generatedGuestEmail;
}

export function ProductCard({ product, flat = false }: { product: ProductSummary; flat?: boolean }) {
  const addItem = useCartStore((state) => state.addItem);
  const { isInWishlist, addItem: addWishlistItem, removeItem: removeWishlistItem } = useWishlistStore();
  const [isFavorite, setIsFavorite] = useState(false);
  const [isStockEmpty, setIsStockEmpty] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);
  const [isQuickViewLoading, setIsQuickViewLoading] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<ProductDetail | null>(null);

  useEffect(() => {
    setIsStockEmpty(product.stock === 0 || product.stock === undefined);
    setIsFavorite(isInWishlist(product.id));
  }, [product.id, product.stock, isInWishlist]);

  const price = product.salePrice ?? product.regularPrice;
  const discountPercent = product.salePrice
    ? Math.round(((product.regularPrice - product.salePrice) / product.regularPrice) * 100)
    : 0;
  const sizesFromCsvCount = product.sizesCsv
    ? new Set(
      product.sizesCsv
        .split(",")
        .map((size) => size.trim())
        .filter(Boolean)
    ).size
    : 0;
  const hasMultipleOptions =
    (product.distinctSizeCount ?? 0) > 1
    || (product.distinctColorCount ?? 0) > 1
    || sizesFromCsvCount > 1;
  const availableSizes = useMemo(() => {
    const sizesFromCsv = product.sizesCsv
      ?.split(",")
      .map((size) => size.trim())
      .filter(Boolean) ?? [];

    if (sizesFromCsv.length > 0) return Array.from(new Set(sizesFromCsv));
    if (product.size?.trim()) return [product.size.trim()];
    return [];
  }, [product.sizesCsv, product.size]);

  const openQuickView = async () => {
    setIsQuickViewLoading(true);
    try {
      const detail = await getProductBySlug(product.slug);
      if (!detail) return;
      setQuickViewProduct(detail);
      setIsQuickViewOpen(true);
    } finally {
      setIsQuickViewLoading(false);
    }
  };

  const handlePrimaryAction = async () => {
    if (isStockEmpty) return;

    if (hasMultipleOptions) {
      await openQuickView();
      return;
    }

    const detail = await getProductBySlug(product.slug);
    const defaultVariant = detail?.variants.find((variant) => variant.stock > 0) ?? detail?.variants[0];
    const unitPrice = price + (defaultVariant?.priceAdjustment ?? 0);
    const compareAtPrice = product.salePrice ? product.regularPrice + (defaultVariant?.priceAdjustment ?? 0) : undefined;

    const fallbackSize = availableSizes[0];
    const selectedSize = defaultVariant?.size?.trim() || fallbackSize;
    const selectedColor = defaultVariant?.color?.trim() || undefined;

    addItem({
      ...product,
      selectedSize,
      selectedColor,
      selectedVariantId: defaultVariant?.id,
      maxAvailableStock: defaultVariant?.stock ?? product.stock,
      unitPrice,
      compareAtPrice
    });
  };

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLoading(true);

    try {
      const userEmail = getWishlistEmail();

      if (isFavorite) {
        removeWishlistItem(product.id);
        setIsFavorite(false);
        await removeFromWishlist(userEmail, product.id);
      } else {
        addWishlistItem({
          productId: product.id,
          name: product.name,
          slug: product.slug,
          image: product.imageUrl,
          regularPrice: product.regularPrice,
          salePrice: product.salePrice,
          brand: product.brand,
          size: product.size,
          sizesCsv: product.sizesCsv,
          distinctColorCount: product.distinctColorCount,
          distinctSizeCount: product.distinctSizeCount,
        });
        setIsFavorite(true);
        await addToWishlist(userEmail, product.id);
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <motion.article whileHover={{ y: -4 }} className={`group relative overflow-hidden bg-transparent transition-transform ${flat ? "" : "rounded-md"}`}>
        <Link href={`/products/${product.slug}`} className={`relative block aspect-[4/5] overflow-hidden bg-muted ${flat ? "" : "rounded-md"}`}>
          <ProductImage src={product.imageUrl} alt={product.name} fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover transition duration-500 group-hover:scale-105" />

        {isStockEmpty ? (
          <div className={`absolute left-3 top-3 bg-red-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-lg ${flat ? "" : "rounded-md"}`}>
            Agotado
          </div>
        ) : product.isOnSale && discountPercent > 0 ? (
          <div className={`absolute left-3 top-3 bg-accent px-2.5 py-1.5 text-xs font-bold text-white shadow-lg flex items-center gap-0.5 ${flat ? "" : "rounded-md"}`}>
            <span>-{discountPercent}%</span>
          </div>
        ) : null}

          <button
            onClick={toggleFavorite}
            disabled={isLoading}
            className={`absolute right-3 top-3 grid h-9 w-9 place-items-center bg-background/90 backdrop-blur transition hover:bg-background/100 disabled:opacity-50 ${flat ? "" : "rounded-md"}`}
            aria-label="Favorito"
          >
            <Heart size={18} className={isFavorite ? "fill-accent text-accent" : ""} />
          </button>
        </Link>

        <div className="pointer-events-none absolute inset-x-3 top-[calc(80%-3.25rem)] z-20 opacity-100 transition-all duration-300 md:translate-y-2 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 md:group-focus-within:translate-y-0 md:group-focus-within:opacity-100">
          <Button
            disabled={isStockEmpty || isQuickViewLoading}
            className="pointer-events-auto w-full border border-white/20 bg-black/60 text-white backdrop-blur-sm hover:bg-black/75"
            onClick={handlePrimaryAction}
          >
            <ShoppingBag size={17} /> {isStockEmpty ? "Agotado" : hasMultipleOptions ? (isQuickViewLoading ? "Cargando..." : "Seleccionar opciones") : "Agregar"}
          </Button>
        </div>

        <div className="space-y-3 px-2 pt-4 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-foreground/50">{product.brand}</p>
              <Link href={`/products/${product.slug}`} className="text-[15px] font-semibold leading-snug">
                {product.name}
              </Link>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <Star size={15} className="fill-accent text-accent" />
              {product.rating.toFixed(1)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold">{formatCurrency(price)}</span>
            {product.salePrice && <span className="text-sm text-foreground/45 line-through">{formatCurrency(product.regularPrice)}</span>}
          </div>
          {availableSizes.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground/55">Tallas:</span>
              {availableSizes.map((size) => (
                <span key={`${product.id}-${size}`} className={`border border-border/80 bg-muted px-2 py-1 text-xs font-semibold text-foreground/80 ${flat ? "" : "rounded-md"}`}>
                  {size}
                </span>
              ))}
            </div>
          )}
        </div>
      </motion.article>
      {quickViewProduct && (
        <ProductQuickView
          product={quickViewProduct}
          isOpen={isQuickViewOpen}
          onClose={() => setIsQuickViewOpen(false)}
        />
      )}
    </>
  );
}