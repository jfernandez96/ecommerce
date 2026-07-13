import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5036/api/v1",
  timeout: 60000,
  withCredentials: true
});

function normalizeProducts(data: unknown) {
  if (!data || typeof data !== "object" || !("items" in data) || !Array.isArray(data.items)) {
    return fallbackProducts;
  }

  const items = data.items as ProductSummary[];
  return items.length > 0 ? items : fallbackProducts;
}

function getFirstValidationMessage(data: unknown) {
  if (!data || typeof data !== "object" || !("errors" in data)) return null;
  const errors = data.errors;
  if (!errors || typeof errors !== "object") return null;

  for (const value of Object.values(errors as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      const firstMessage = value.find((item) => typeof item === "string");
      if (typeof firstMessage === "string" && firstMessage.trim()) return firstMessage;
    }
  }

  return null;
}

function getApiErrorMessage(error: unknown) {
  if (!axios.isAxiosError(error)) return null;
  const data = error.response?.data;
  const validationMessage = getFirstValidationMessage(data);
  if (validationMessage) return validationMessage;
  if (data && typeof data === "object" && "detail" in data && typeof data.detail === "string" && data.detail.trim()) return data.detail;
  if (data && typeof data === "object" && "title" in data && typeof data.title === "string" && data.title.trim()) return data.title;
  return error.message;
}

let refreshPromise: Promise<void> | null = null;

function clearAdminSession() {
  document.cookie = "role=; path=/; max-age=0; SameSite=Lax";
}

function isAuthRequest(url?: string) {
  return Boolean(url && /\/auth\/(login|refresh|logout)$/i.test(url));
}

async function refreshAdminSession() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${api.defaults.baseURL}/auth/refresh`, undefined, { withCredentials: true })
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

async function logoutSilently() {
  try {
    await axios.post(`${api.defaults.baseURL}/auth/logout`, undefined, { withCredentials: true });
  } catch {
    clearAdminSession();
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (typeof window !== "undefined" && error?.response?.status === 401) {
      const requestConfig = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
      const currentPath = window.location.pathname + window.location.search;
      const isAdminPath = window.location.pathname.startsWith("/admin");

      if (isAdminPath && requestConfig && !requestConfig._retry && !isAuthRequest(requestConfig.url)) {
        requestConfig._retry = true;

        try {
          await refreshAdminSession();
          return api.request(requestConfig);
        } catch {
          await logoutSilently();
        }
      }

      clearAdminSession();
      if (isAdminPath && !window.location.pathname.startsWith("/admin/login")) {
        window.location.href = `/admin/login?next=${encodeURIComponent(currentPath)}`;
      }
      return Promise.reject(new Error("Sesion expirada o no autorizada. Ingresa nuevamente como administrador."));
    }

    const message = getApiErrorMessage(error);
    if (message) return Promise.reject(new Error(message));

    return Promise.reject(error);
  }
);

export type ProductSummary = {
  id: string;
  name: string;
  slug: string;
  sku?: string;
  description?: string;
  brand: string;
  category: string;
  regularPrice: number;
  salePrice?: number;
  stock: number;
  size?: string;
  imageUrl: string;
  rating: number;
  isOnSale: boolean;
  isNew?: boolean;
  sizesCsv?: string;
  variantCount?: number;
  distinctColorCount?: number;
  distinctSizeCount?: number;
};

export type CheckoutItemRequest = {
  productId: string;
  productVariantId?: string;
  quantity: number;
};

export type CreateOrderRequest = {
  email: string;
  fullName: string;
  phone: string;
  line1: string;
  district: string;
  province: string;
  department: string;
  reference?: string;
  documentType: "receipt" | "invoice";
  customerDocumentType: "dni" | "ruc" | "ce" | "passport";
  documentNumber: string;
  paymentMethod: "card" | "yape";
  fulfillmentType: "shipping" | "pickup";
  storeId: string;
  notes?: string;
  items: CheckoutItemRequest[];
};

export type OrderCheckoutResponse = {
  orderId: string;
  orderNumber: string;
  status: string;
  total: number;
  storeId?: string | null;
  storeName?: string | null;
  fulfillmentType?: "shipping" | "pickup";
  payment: {
    paymentId: string;
    provider: string;
    status: string;
    integrationMode: string;
    externalReference: string;
    publicKey?: string | null;
    clientSecret?: string | null;
    checkoutUrl?: string | null;
    qrCodeUrl?: string | null;
    expiresAt?: string | null;
    instructions: string[];
  };
};

export type PublicPromotion = {
  id: string;
  name: string;
  type: string;
  value: number;
  startsAt: string;
  endsAt: string;
  bannerUrl?: string;
  isActive: boolean;
  productId?: string;
  categoryId?: string;
  brandId?: string;
};

export type PublicBanner = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  linkUrl?: string;
  placement: string;
  sortOrder: number;
  startsAt?: string;
  endsAt?: string;
  isActive: boolean;
  createdAt: string;
};

export type PublicCategory = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  sortOrder?: number;
  parentId?: string;
};

export type PublicBrand = {
  id: string;
  name: string;
  isActive: boolean;
};

export type ProductDetail = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  code: string;
  brand: string;
  category: string;
  description: string;
  longDescription: string;
  regularPrice: number;
  salePrice?: number;
  stock: number;
  weightKg: number;
  material: string;
  videoUrl?: string;
  images: Array<{ url: string; altText: string; isPrimary: boolean; color?: string | null }>;
  variants: Array<{ id: string; sku: string; color: string; size: string; stock: number; priceAdjustment?: number }>;
  storeStocks?: Array<{ storeId: string; storeName: string; storeCode: string; stock: number; isActive: boolean }>;
  tags: string[];
};

export type StoreLocationDto = {
  id: string;
  name: string;
  code: string;
  address: string;
  district?: string | null;
  province?: string | null;
  department?: string | null;
  phone?: string | null;
  pickupInstructions?: string | null;
  isActive: boolean;
  createdAt: string;
};

export const fallbackProducts: ProductSummary[] = [
  { id: "1", name: "Overshirt Milano", slug: "overshirt-milano", brand: "Atelier Norte", category: "Hombre", regularPrice: 229, salePrice: 189, stock: 18, imageUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=1200&auto=format&fit=crop", rating: 4.8, isOnSale: true },
  { id: "2", name: "Sneaker Aero Knit", slug: "sneaker-aero-knit", brand: "Stride", category: "Zapatillas", regularPrice: 349, stock: 12, imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1200&auto=format&fit=crop", rating: 4.9, isOnSale: false },
  { id: "3", name: "Bolso Lumiere", slug: "bolso-lumiere", brand: "Maison C", category: "Bolsos", regularPrice: 299, salePrice: 249, stock: 7, imageUrl: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?q=80&w=1200&auto=format&fit=crop", rating: 4.7, isOnSale: true },
  { id: "4", name: "Perfume Bruma 70ml", slug: "perfume-bruma-70", brand: "Olfacto", category: "Perfumes", regularPrice: 189, stock: 24, imageUrl: "https://images.unsplash.com/photo-1594035910387-fea47794261f?q=80&w=1200&auto=format&fit=crop", rating: 4.6, isOnSale: false }
];

export async function getProducts(pageSize = 12) {
  try {
    const { data } = await api.get("/products", { params: { pageSize, sortBy: "newest" } });
    return normalizeProducts(data);
  } catch {
    return fallbackProducts;
  }
}

export async function getPromotions() {
  try {
    const { data } = await api.get("/promotions");
    return data as PublicPromotion[];
  } catch {
    return [];
  }
}

export async function getProductBySlug(slug: string) {
  try {
    const { data } = await api.get(`/products/${slug}`);
    return data as ProductDetail;
  } catch {
    return null;
  }
}

export async function getBanners() {
  try {
    const { data } = await api.get("/banners");
    return data as PublicBanner[];
  } catch {
    return [];
  }
}

export async function getCategories() {
  try {
    const { data } = await api.get("/categories");
    return (data as PublicCategory[]).filter((category) => category.isActive);
  } catch {
    return [];
  }
}

export async function getBrands() {
  try {
    const { data } = await api.get("/brands");
    return (data as PublicBrand[]).filter((brand) => brand.isActive);
  } catch {
    return [];
  }
}

export async function createOrder(payload: CreateOrderRequest) {
  const { data } = await api.post("/orders/checkout", payload);
  return data as OrderCheckoutResponse;
}

export async function getPublicStores() {
  try {
    const { data } = await api.get("/stores/public");
    return data as StoreLocationDto[];
  } catch {
    return [];
  }
}

export type WishlistItemDto = {
  productId: string;
  productName: string;
  productSlug: string;
  productImage: string;
  regularPrice: number;
  salePrice?: number;
  brand: string;
};

export type WishlistDto = {
  id: string;
  email: string;
  items: WishlistItemDto[];
};

export type AddToWishlistResultDto = {
  isAdded: boolean;
  message: string;
};

export type RemoveFromWishlistResultDto = {
  isRemoved: boolean;
  message: string;
};

export async function getWishlist(email: string) {
  try {
    const { data } = await api.get("/wishlist", { params: { email } });
    return data as WishlistDto;
  } catch {
    return { id: "", email, items: [] } as WishlistDto;
  }
}

export async function addToWishlist(email: string, productId: string) {
  const { data } = await api.post("/wishlist/add", { email, productId });
  return data as AddToWishlistResultDto;
}

export async function removeFromWishlist(email: string, productId: string) {
  const { data } = await api.post("/wishlist/remove", { email, productId });
  return data as RemoveFromWishlistResultDto;
}

// ─── Store public settings ────────────────────────────────────────────────────

export type PublicStoreSettings = {
  paymentGatewayEnabled: boolean;
  freeShippingLima: boolean;
  provinceShippingCost: number;
};

export type PublicFooterSettings = {
  companyRuc: string;
  companyBusinessName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
};

export async function getPublicSettings(): Promise<PublicStoreSettings> {
  try {
    const { data } = await api.get("/settings/public");
    return data as PublicStoreSettings;
  } catch {
    return { paymentGatewayEnabled: false, freeShippingLima: true, provinceShippingCost: 15 };
  }
}

export async function getPublicFooterSettings(): Promise<PublicFooterSettings> {
  try {
    const { data } = await api.get("/settings/public-footer");
    return data as PublicFooterSettings;
  } catch {
    return {
      companyRuc: "20613512277",
      companyBusinessName: "Descosale E.I.R.L",
      companyAddress: "Direccion pendiente",
      companyPhone: "+51 937211721",
      companyEmail: "descoaostv@gmail.com"
    };
  }
}

export type ClaimBookRequest = {
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
  responseChannel: string;
  email: string;
  address: string;
  phone?: string;
  isMinor: boolean;
  contractedGoodType: string;
  orderNumber?: string;
  claimedAmount?: number;
  goodDescription: string;
  claimType: string;
  claimDetail: string;
  consumerRequest: string;
  acceptedTerms: boolean;
};

export type ClaimBookResponse = {
  id: string;
  code: string;
  createdAt: string;
};

export async function registerClaimBookEntry(payload: ClaimBookRequest): Promise<ClaimBookResponse> {
  const { data } = await api.post("/claim-book", payload);
  return data as ClaimBookResponse;
}

// ─── Geo ─────────────────────────────────────────────────────────────────────

export type DepartmentDto = { id: string; code: string; name: string };
export type ProvinceDto = { id: string; departmentId: string; code: string; name: string };
export type DistrictDto = { id: string; provinceId: string; code: string; name: string };

export async function getDepartments(): Promise<DepartmentDto[]> {
  try {
    const { data } = await api.get("/geo/departments");
    return data as DepartmentDto[];
  } catch {
    return [];
  }
}

export async function getProvinces(departmentId: string): Promise<ProvinceDto[]> {
  try {
    const { data } = await api.get(`/geo/departments/${departmentId}/provinces`);
    return data as ProvinceDto[];
  } catch {
    return [];
  }
}

export async function getDistricts(provinceId: string): Promise<DistrictDto[]> {
  try {
    const { data } = await api.get(`/geo/provinces/${provinceId}/districts`);
    return data as DistrictDto[];
  } catch {
    return [];
  }
}