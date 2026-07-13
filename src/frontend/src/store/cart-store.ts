import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProductSummary } from "@/lib/api";

export type CartItem = ProductSummary & {
  lineId: string;
  quantity: number;
  selectedSize?: string;
  selectedColor?: string;
  selectedVariantId?: string;
  maxAvailableStock?: number;
  unitPrice: number;
  compareAtPrice?: number;
};

export type AddCartItemInput = ProductSummary & {
  quantity?: number;
  selectedSize?: string;
  selectedColor?: string;
  selectedVariantId?: string;
  maxAvailableStock?: number;
  unitPrice?: number;
  compareAtPrice?: number;
};

const buildLineId = (productId: string, selectedSize?: string, selectedColor?: string, selectedVariantId?: string) =>
  [productId, selectedVariantId ?? "general", selectedSize ?? "na", selectedColor ?? "na"].join("::");

type CartState = {
  items: CartItem[];
  isDrawerOpen: boolean;
  addItem: (product: AddCartItemInput) => void;
  removeItem: (lineId: string) => void;
  changeQuantity: (lineId: string, quantity: number) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  clear: () => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      isDrawerOpen: false,
      addItem: (product) => set((state) => {
        const unitPrice = product.unitPrice ?? product.salePrice ?? product.regularPrice;
        const compareAtPrice = product.compareAtPrice ?? (product.salePrice ? product.regularPrice : undefined);
        const requestedQuantity = Math.max(product.quantity ?? 1, 1);
        const lineId = buildLineId(product.id, product.selectedSize, product.selectedColor, product.selectedVariantId);
        const current = state.items.find((item) => item.lineId === lineId);
        const limit = product.maxAvailableStock;

        if (current) {
          const nextQuantity = limit === undefined ? current.quantity + requestedQuantity : Math.min(current.quantity + requestedQuantity, limit);
          return {
            isDrawerOpen: true,
            items: state.items.map((item) => item.lineId === lineId ? { ...item, quantity: nextQuantity, maxAvailableStock: limit ?? item.maxAvailableStock } : item)
          };
        }

        const quantity = limit === undefined ? requestedQuantity : Math.min(requestedQuantity, limit);
        return {
          isDrawerOpen: true,
          items: [...state.items, { ...product, lineId, quantity, unitPrice, compareAtPrice }]
        };
      }),
      removeItem: (lineId) => set((state) => ({ items: state.items.filter((item) => item.lineId !== lineId) })),
      changeQuantity: (lineId, quantity) => set((state) => ({
        items: state.items.map((item) => {
          if (item.lineId !== lineId) return item;
          const nextQuantity = Math.max(quantity, 1);
          const safeQuantity = item.maxAvailableStock === undefined ? nextQuantity : Math.min(nextQuantity, item.maxAvailableStock);
          return { ...item, quantity: safeQuantity };
        })
      })),
      openDrawer: () => set({ isDrawerOpen: true }),
      closeDrawer: () => set({ isDrawerOpen: false }),
      clear: () => set({ items: [], isDrawerOpen: false })
    }),
    { name: "premium-commerce-cart" }
  )
);