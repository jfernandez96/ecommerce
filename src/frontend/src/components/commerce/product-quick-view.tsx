"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductImage } from "@/components/commerce/product-image";
import { formatCurrency } from "@/lib/utils";
import type { ProductDetail } from "@/lib/api";
import { useCartStore } from "@/store/cart-store";

interface ProductQuickViewProps {
  product: ProductDetail;
  isOpen: boolean;
  onClose: () => void;
}

export function ProductQuickView({ product, isOpen, onClose }: ProductQuickViewProps) {
  const addItem = useCartStore((state) => state.addItem);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string | null>(product.variants?.[0]?.color ?? null);
  const [selectedSize, setSelectedSize] = useState<string | null>(product.variants?.[0]?.size ?? null);
  const [quantity, setQuantity] = useState(1);

  const images = useMemo(() => product.images || [], [product.images]);
  const currentImage = images[currentImageIndex];

  useEffect(() => {
    setCurrentImageIndex(0);
    setSelectedColor(product.variants?.[0]?.color ?? null);
    setSelectedSize(product.variants?.[0]?.size ?? null);
    setQuantity(1);
  }, [product.id, product.variants]);

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const filteredVariants = product.variants?.filter((v) =>
    (!selectedColor || v.color === selectedColor) && (!selectedSize || v.size === selectedSize)
  ) ?? [];

  const selectedVariant = filteredVariants[0];
  const availableColors = Array.from(new Set(product.variants?.map((v) => v.color) ?? []));
  const availableSizes = Array.from(new Set(
    product.variants?.filter((v) => !selectedColor || v.color === selectedColor).map((v) => v.size) ?? []
  ));

  useEffect(() => {
    if (!selectedColor || !selectedSize) return;
    const sizeStillAvailable = availableSizes.includes(selectedSize);
    if (!sizeStillAvailable) setSelectedSize(availableSizes[0] ?? null);
  }, [availableSizes, selectedColor, selectedSize]);

  const handleAddToCart = () => {
    const variant = product.variants?.find((v) => v.color === selectedColor && v.size === selectedSize);
    const normalizedSelectedSize = selectedSize ?? undefined;
    const normalizedSelectedColor = selectedColor ?? undefined;
    addItem({
      id: product.id,
      name: product.name,
      slug: product.slug,
      brand: product.brand,
      category: product.category,
      regularPrice: product.regularPrice,
      salePrice: product.salePrice,
      stock: variant?.stock ?? 0,
      imageUrl: product.images[0]?.url ?? "",
      rating: 4.5,
      isOnSale: !!product.salePrice,
      unitPrice: (product.salePrice ?? product.regularPrice) + (variant?.priceAdjustment ?? 0),
      quantity,
      selectedSize: normalizedSelectedSize,
      selectedColor: normalizedSelectedColor,
      selectedVariantId: variant?.id,
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-4xl max-h-[90vh] bg-background rounded-lg overflow-auto"
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 z-10 rounded-md bg-background/80 p-2 hover:bg-background transition"
            >
              <X size={20} />
            </button>

            <div className="grid grid-cols-1 gap-8 p-6 md:grid-cols-2">
              {/* Image Gallery */}
              <div className="space-y-4">
                <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentImageIndex}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0"
                    >
                      <ProductImage
                        src={currentImage?.url ?? ""}
                        alt={currentImage?.altText ?? ""}
                        fill
                        className="object-cover"
                      />
                    </motion.div>
                  </AnimatePresence>

                  {images.length > 1 && (
                    <>
                      <button
                        onClick={prevImage}
                        className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 hover:bg-background transition"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <button
                        onClick={nextImage}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 hover:bg-background transition"
                      >
                        <ChevronRight size={20} />
                      </button>
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white">
                        {currentImageIndex + 1} / {images.length}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Product Info & Options */}
              <div className="space-y-6">
                <div>
                  <p className="text-xs uppercase text-foreground/50">{product.brand}</p>
                  <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
                  <p className="mt-2 text-foreground/70">{product.description}</p>
                </div>

                {/* Price */}
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold">{formatCurrency(product.salePrice ?? product.regularPrice)}</span>
                  {product.salePrice && (
                    <span className="text-lg text-foreground/45 line-through">
                      {formatCurrency(product.regularPrice)}
                    </span>
                  )}
                </div>

                {/* Color Selection */}
                {availableColors.length > 0 && (
                  <div>
                    <label className="text-sm font-semibold">Color</label>
                    <div className="mt-2 flex gap-2">
                      {availableColors.map((color) => (
                        <button
                          key={color}
                          onClick={() => setSelectedColor(color)}
                          className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                            selectedColor === color
                              ? "bg-accent text-white"
                              : "border border-border bg-muted hover:bg-muted/80"
                          }`}
                        >
                          {color}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Size Selection */}
                {availableSizes.length > 0 && (
                  <div>
                    <label className="text-sm font-semibold">Talla</label>
                    <div className="mt-2 flex gap-2">
                      {availableSizes.map((size) => (
                        <button
                          key={size}
                          onClick={() => setSelectedSize(size)}
                          className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                            selectedSize === size
                              ? "bg-accent text-white"
                              : "border border-border bg-muted hover:bg-muted/80"
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stock Status */}
                {selectedVariant && (
                  <p className="text-sm">
                    <span className={selectedVariant.stock > 0 ? "text-green-600" : "text-red-600"}>
                      {selectedVariant.stock > 0
                        ? `${selectedVariant.stock} disponibles`
                        : "Sin stock"}
                    </span>
                  </p>
                )}

                {/* Quantity */}
                <div>
                  <label className="text-sm font-semibold">Cantidad</label>
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="rounded-md border border-border px-3 py-2 hover:bg-muted"
                    >
                      −
                    </button>
                    <span className="text-center w-12">{quantity}</span>
                    <button
                      onClick={() => setQuantity(quantity + 1)}
                      className="rounded-md border border-border px-3 py-2 hover:bg-muted"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Add to Cart Button */}
                <Button
                  onClick={handleAddToCart}
                  disabled={!selectedVariant || selectedVariant.stock === 0}
                  className="w-full"
                >
                  <ShoppingBag size={18} /> Agregar al carrito
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
