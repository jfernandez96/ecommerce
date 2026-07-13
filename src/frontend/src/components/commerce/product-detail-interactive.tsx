"use client";

import { MapPin, MessageCircle, Share2, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";
import { ProductImage } from "@/components/commerce/product-image";
import { QuantityStepper } from "@/components/commerce/quantity-stepper";
import { Button } from "@/components/ui/button";
import { type ProductDetail } from "@/lib/api";
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
          <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-muted">
            <ProductImage src={images[selectedImageIndex] ?? images[0]} alt={product.name} fill priority className="object-cover" />
          </div>
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