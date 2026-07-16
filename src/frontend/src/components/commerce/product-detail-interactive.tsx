"use client";

import { ChevronLeft, ChevronRight, MapPin, MessageCircle, Search, Share2, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { ProductImage } from "@/components/commerce/product-image";
import { QuantityStepper } from "@/components/commerce/quantity-stepper";
import { Button } from "@/components/ui/button";
import { type ProductDetail } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/media-url";
import { formatCurrency } from "@/lib/utils";
import { useCartStore } from "@/store/cart-store";

const normalize = (value: string) => value.trim().toLowerCase();

type Props = {
  product: ProductDetail;
};

export function ProductDetailInteractive({ product }: Props) {
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);
  const variants = product.variants;
  const firstInStockVariant = variants.find((variant) => variant.stock > 0) ?? variants[0] ?? null;

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [zoomPosition, setZoomPosition] = useState({ x: 50, y: 50 });
  const [zoomEnabled, setZoomEnabled] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef(0);
  const [selectedSize, setSelectedSize] = useState(firstInStockVariant?.size ?? "");
  const [selectedColor, setSelectedColor] = useState(firstInStockVariant?.color ?? "");
  const [quantity, setQuantity] = useState(1);
  const [isNavigatingToCheckout, setIsNavigatingToCheckout] = useState(false);

  const sizes = useMemo(() => Array.from(new Set(variants.map((variant) => variant.size).filter((size) => size.trim().length > 0))), [variants]);
  const colors = useMemo(() => Array.from(new Set(variants.map((variant) => variant.color).filter((color) => color.trim().length > 0))), [variants]);

  const sizeOptions = sizes.map((size) => ({
    value: size,
    inStock: variants.some((variant) => normalize(variant.size) === normalize(size) && normalize(variant.color) === normalize(selectedColor || variant.color) && variant.stock > 0)
  }));

  const colorOptions = colors.map((color) => ({
    value: color,
    inStock: variants.some((variant) => normalize(variant.color) === normalize(color) && normalize(variant.size) === normalize(selectedSize || variant.size) && variant.stock > 0)
  }));

  const selectedVariant = variants.find(
    (variant) => normalize(variant.size) === normalize(selectedSize) && normalize(variant.color) === normalize(selectedColor)
  ) ?? null;

  const visibleImages = useMemo(() => {
    const commonImages = product.images.filter((image) => !image.color || image.color.trim().length === 0);
    if (!selectedColor) return product.images.length > 0 ? product.images : commonImages;

    const colorSpecific = product.images.filter((image) => normalize(image.color ?? "") === normalize(selectedColor));
    if (colorSpecific.length > 0) return colorSpecific;
    if (commonImages.length > 0) return commonImages;
    return product.images;
  }, [product.images, selectedColor]);

  const images = visibleImages.length ? visibleImages.map((image) => image.url) : [];
  const previewImages = images.length > 0 ? images.slice(0, 4) : [undefined];
  const selectedImageSrc = images[selectedImageIndex] ?? images[0];
  const selectedResolvedImage = resolveMediaUrl(selectedImageSrc);

  const variantStock = selectedVariant?.stock ?? 0;
  const canBuy = variantStock > 0;
  const unitPrice = (product.salePrice ?? product.regularPrice) + (selectedVariant?.priceAdjustment ?? 0);
  const compareAtPrice = product.salePrice ? product.regularPrice + (selectedVariant?.priceAdjustment ?? 0) : undefined;
  const storeStocks = product.storeStocks ?? [];

  const addSelectedItem = () => {
    if (!canBuy) return;

    addItem({
      id: product.id,
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      category: product.category,
      imageUrl: images[selectedImageIndex] ?? images[0] ?? product.images[0]?.url ?? "",
      regularPrice: product.regularPrice,
      salePrice: product.salePrice,
      stock: product.stock,
      rating: 4.5,
      isOnSale: !!product.salePrice,
      size: selectedVariant?.size,
      quantity,
      selectedSize: selectedVariant?.size,
      selectedColor: selectedVariant?.color,
      selectedVariantId: selectedVariant?.id,
      maxAvailableStock: selectedVariant?.stock ?? product.stock,
      unitPrice,
      compareAtPrice
    });
  };

  useEffect(() => {
    if (selectedImageIndex >= images.length) setSelectedImageIndex(0);
  }, [images.length, selectedImageIndex]);

  const showPreviousImage = () => {
    if (images.length <= 1) return;
    setSelectedImageIndex((current) => (current - 1 + images.length) % images.length);
  };

  const showNextImage = () => {
    if (images.length <= 1) return;
    setSelectedImageIndex((current) => (current + 1) % images.length);
  };

  const handleZoomMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const offsetX = ((event.clientX - bounds.left) / bounds.width) * 100;
    const offsetY = ((event.clientY - bounds.top) / bounds.height) * 100;

    setZoomPosition({
      x: Math.min(100, Math.max(0, offsetX)),
      y: Math.min(100, Math.max(0, offsetY))
    });
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
    touchDeltaX.current = 0;
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return;
    touchDeltaX.current = (event.touches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null) return;

    if (Math.abs(touchDeltaX.current) >= 45) {
      if (touchDeltaX.current < 0) {
        showNextImage();
      } else {
        showPreviousImage();
      }
    }

    touchStartX.current = null;
    touchDeltaX.current = 0;
  };

  useEffect(() => {
    if (variantStock > 0 && quantity > variantStock) {
      setQuantity(variantStock);
      return;
    }

    if (quantity < 1) {
      setQuantity(1);
    }
  }, [quantity, variantStock]);

  return (
    <main className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-2">
        <section className="grid items-start gap-2 sm:grid-cols-[84px_1fr]">
          <div className="hidden gap-2 sm:grid">
            {previewImages.map((imageUrl, index) => (
              <button
                key={`${imageUrl ?? "empty"}-${index}`}
                type="button"
                onClick={() => setSelectedImageIndex(index)}
                className={`relative aspect-square overflow-hidden rounded-lg bg-muted ${selectedImageIndex === index ? "ring-2 ring-primary" : ""}`}
              >
                <ProductImage src={imageUrl} alt={product.name} fill className="object-cover" />
              </button>
            ))}
          </div>
          <div
            className="relative aspect-[4/5] overflow-hidden rounded-xl bg-muted"
            onMouseEnter={() => setZoomEnabled(true)}
            onMouseMove={handleZoomMove}
            onMouseLeave={() => setZoomEnabled(false)}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
            <ProductImage src={selectedImageSrc} alt={product.name} fill priority className="object-cover" />

            <div className="pointer-events-none absolute right-3 top-3 hidden items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-xs text-white sm:flex">
              <Search size={12} /> Zoom
            </div>

            {zoomEnabled && selectedResolvedImage && (
              <div
                className="pointer-events-none absolute inset-0 hidden border border-white/30 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)] sm:block"
                style={{
                  backgroundImage: `url(${selectedResolvedImage})`,
                  backgroundPosition: `${zoomPosition.x}% ${zoomPosition.y}%`,
                  backgroundSize: "220%",
                  backgroundRepeat: "no-repeat"
                }}
              />
            )}

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={showPreviousImage}
                  className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white sm:hidden"
                  aria-label="Imagen anterior"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={showNextImage}
                  className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white sm:hidden"
                  aria-label="Imagen siguiente"
                >
                  <ChevronRight size={18} />
                </button>
                <div className="absolute bottom-2 left-1/2 rounded-full bg-black/55 px-2 py-1 text-[11px] text-white sm:hidden -translate-x-1/2">
                  {selectedImageIndex + 1}/{images.length}
                </div>
              </>
            )}
          </div>

          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 sm:hidden">
              {images.map((imageUrl, index) => (
                <button
                  key={`${imageUrl}-${index}`}
                  type="button"
                  onClick={() => setSelectedImageIndex(index)}
                  className={`relative h-16 w-14 shrink-0 overflow-hidden rounded-md border ${selectedImageIndex === index ? "border-primary ring-1 ring-primary/50" : "border-border"}`}
                  aria-label={`Ver imagen ${index + 1}`}
                >
                  <ProductImage src={imageUrl} alt={product.name} fill className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-7">
          <div>
            <p className="text-sm uppercase text-primary">{product.brand}</p>
            <h1 className="mt-2 text-4xl font-black">{product.name}</h1>
            <p className="mt-4 text-foreground/65">{product.description}</p>
          </div>

          <div className="flex items-end gap-3">
            <strong className="text-3xl">{formatCurrency(unitPrice)}</strong>
            {compareAtPrice && <span className="text-foreground/45 line-through">{formatCurrency(compareAtPrice)}</span>}
          </div>

          {sizes.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold">Talla</p>
              <div className="flex flex-wrap gap-2">
                {sizeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSelectedSize(option.value)}
                    disabled={!option.inStock}
                    className={`rounded border px-3 py-1.5 text-sm ${selectedSize === option.value ? "border-primary bg-primary/10" : "border-border"} ${!option.inStock ? "cursor-not-allowed opacity-40" : "hover:bg-muted"}`}
                  >
                    {option.value}
                  </button>
                ))}
              </div>
            </div>
          )}

          {colors.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold">Color</p>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSelectedColor(option.value)}
                    disabled={!option.inStock}
                    className={`rounded border px-3 py-1.5 text-sm ${selectedColor === option.value ? "border-primary bg-primary/10" : "border-border"} ${!option.inStock ? "cursor-not-allowed opacity-40" : "hover:bg-muted"}`}
                  >
                    {option.value}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className={`text-sm ${canBuy ? "text-foreground/80" : "text-red-600"}`}>
            {canBuy ? `Stock disponible para esta combinacion: ${variantStock}` : "Sin stock para la talla y color seleccionados"}
          </p>

          {storeStocks.length > 0 && (
            <div className="rounded-md border border-border p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <MapPin size={16} /> Stock por tienda
              </div>
              <div className="space-y-2 text-sm">
                {storeStocks.map((item) => (
                  <div key={item.storeId} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
                    <span className="font-medium">{item.storeName}</span>
                    <span className={item.stock > 0 ? "text-emerald-700" : "text-red-600"}>{item.stock} und.</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-semibold">Cantidad</p>
            <QuantityStepper value={quantity} max={variantStock || undefined} onChange={setQuantity} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button disabled={!canBuy} onClick={addSelectedItem}><ShoppingBag size={18} /> Agregar al carrito</Button>
            <Button variant="secondary" disabled={!canBuy || isNavigatingToCheckout} onClick={() => {
              addSelectedItem();
              setIsNavigatingToCheckout(true);
              startTransition(() => {
                router.push("/checkout");
              });
            }}>{isNavigatingToCheckout ? "Cargando..." : "Comprar ahora"}</Button>
            <Button variant="secondary"><MessageCircle size={18} /> WhatsApp</Button>
            <Button variant="ghost"><Share2 size={18} /> Compartir</Button>
          </div>

          <div className="rounded-md border border-border p-5">
            <h2 className="font-bold">Especificaciones</h2>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm text-foreground/70">
              <dt>Material</dt>
              <dd>{product.material || "No especificado"}</dd>
              <dt>Stock</dt>
              <dd>{product.stock} unidades</dd>
              <dt>SKU</dt>
              <dd>{product.sku}</dd>
              <dt>Estado</dt>
              <dd>{product.stock > 0 ? "Disponible" : "Agotado"}</dd>
            </dl>
          </div>
        </section>
      </main>
    );
  }