import { api, type ProductSummary } from "@/lib/api";

export type CategoryDto = { id: string; name: string; slug: string; description?: string; imageUrl?: string; isActive: boolean; sortOrder: number; parentId?: string; createdAt: string };
export type BrandDto = { id: string; name: string; slug: string; logoUrl?: string; isActive: boolean; createdAt: string };
export type PromotionDto = { id: string; name: string; type: string; value: number; startsAt: string; endsAt: string; bannerUrl?: string; isActive: boolean; productId?: string; categoryId?: string; brandId?: string };
export type BannerDto = { id: string; title: string; subtitle: string; imageUrl: string; linkUrl?: string; placement: string; sortOrder: number; startsAt?: string; endsAt?: string; isActive: boolean; createdAt: string };
export type ProductVariantPayload = { color: string; size: string; stock: number; priceAdjustment?: number | null };
export type ProductVariantDto = { id: string; sku: string; color: string; size: string; stock: number; priceAdjustment?: number | null };
export type ProductImagePayload = { url: string; color?: string | null };
export type UploadScope = "products" | "banners" | "promotions" | "categories" | "brands";

export type ProductPayload = {
  name: string;
  slug: string;
  sku: string;
  code: string;
  brandId: string;
  categoryId: string;
  subcategoryId?: string | null;
  mainStoreId: string;
  regularPrice: number;
  salePrice?: number | null;
  cost: number;
  stock: number;
  minimumStock: number;
  weightKg: number;
  material: string;
  size?: string | null;
  description: string;
  longDescription: string;
  videoUrl?: string | null;
  seoTitle: string;
  seoDescription: string;
  status: number;
  variants?: ProductVariantPayload[];
  images?: ProductImagePayload[];
};

export type ProductAdminDto = Omit<ProductPayload, "variants"> & {
  id: string;
  images: Array<{ url: string; altText: string; isPrimary: boolean; color?: string | null }>;
  variants: ProductVariantDto[];
  storeStocks?: Array<{ storeId: string; storeName: string; storeCode: string; stock: number; isActive: boolean }>;
};

export type ProductSearchPage = {
  items: ProductSummary[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type OrderAdminListItemDto = {
  id: string;
  number: string;
  storeId?: string | null;
  storeName?: string | null;
  fulfillmentType?: "shipping" | "pickup";
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  itemCount: number;
  total: number;
  status: number;
  paymentMethod: number;
  paymentStatus: string;
  paymentProvider: string;
  createdAt: string;
};

export type OrderAdminItemDto = {
  id: string;
  productId: string;
  productVariantId?: string | null;
  productName: string;
  sku: string;
  color?: string | null;
  size?: string | null;
  unitPrice: number;
  quantity: number;
  total: number;
};

export type OrderAdminPaymentDto = {
  id: string;
  provider: string;
  status: string;
  integrationMode: string;
  amount: number;
  externalReference?: string | null;
  expiresAt?: string | null;
  createdAt: string;
};

export type OrderAdminDetailDto = {
  id: string;
  number: string;
  storeId?: string | null;
  storeName?: string | null;
  fulfillmentType?: "shipping" | "pickup";
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  documentNumber: string;
  documentType: number;
  status: number;
  paymentMethod: number;
  paymentStatus: string;
  paymentProvider: string;
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  total: number;
  trackingCode: string;
  notes: string;
  addressLine1: string;
  district: string;
  province: string;
  department: string;
  reference: string;
  createdAt: string;
  items: OrderAdminItemDto[];
  payments: OrderAdminPaymentDto[];
};

export type OrderAdminSummaryDto = {
  totalOrders: number;
  confirmedRevenue: number;
  pendingPayments: number;
  confirmedPayments: number;
  rejectedPayments: number;
  cancelledOrders: number;
};

export type OrderAdminSearchPage = {
  items: OrderAdminListItemDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type OrderAdminSearchResultDto = {
  page: OrderAdminSearchPage;
  summary: OrderAdminSummaryDto;
};

export type SaleAdminItemDto = {
  orderId: string;
  orderNumber: string;
  storeId?: string | null;
  storeName?: string | null;
  sunatSeries?: string | null;
  sunatCorrelative?: number | null;
  sunatStatus: string;
  sunatStatusMessage?: string | null;
  productId: string;
  productVariantId?: string | null;
  productName: string;
  sku: string;
  variantLabel?: string | null;
  customerName: string;
  customerEmail: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  orderTotal: number;
  orderStatus: number;
  paymentMethod: number;
  paymentStatus: string;
  saleDate: string;
};

export type SaleAdminSummaryDto = {
  grossSales: number;
  totalOrders: number;
  totalLines: number;
  unitsSold: number;
};

export type SaleDailyPointDto = {
  dateLabel: string;
  grossSales: number;
  orders: number;
  unitsSold: number;
};

export type TopSellingProductDto = {
  productId: string;
  productName: string;
  sku: string;
  unitsSold: number;
  revenue: number;
  orders: number;
};

export type SaleAdminDashboardDto = {
  dailySales: SaleDailyPointDto[];
  topProducts: TopSellingProductDto[];
};

export type SaleAdminSearchPage = {
  items: SaleAdminItemDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type SaleAdminSearchResultDto = {
  page: SaleAdminSearchPage;
  summary: SaleAdminSummaryDto;
  dashboard: SaleAdminDashboardDto;
};

export type SendSaleToSunatResultDto = {
  orderId: string;
  status: string;
  message: string;
  xmlFileName: string;
  ticket?: string | null;
  digestValue?: string | null;
  sentAt: string;
  acceptedAt?: string | null;
};

export type AdminProductSearchParams = {
  page?: number;
  pageSize?: number;
  query?: string;
  sortBy?: "newest" | "price-asc" | "price-desc" | "name-asc";
};

export type AdminOrderSearchParams = {
  page?: number;
  pageSize?: number;
  startDate?: string;
  endDate?: string;
  paymentStatus?: string;
  orderStatus?: number;
  customerName?: string;
  orderNumber?: string;
};

export type AdminSalesSearchParams = {
  page?: number;
  pageSize?: number;
  startDate?: string;
  endDate?: string;
  product?: string;
};

export type AdminInventoryMovementsParams = {
  page?: number;
  pageSize?: number;
  query?: string;
  startDate?: string;
  endDate?: string;
  storeId?: string;
};

export type InventoryMovementDto = {
  id: string;
  storeId?: string | null;
  storeName?: string | null;
  productId: string;
  productVariantId?: string | null;
  productName: string;
  productSku: string;
  variantLabel?: string | null;
  movementType: number;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  supplierName?: string | null;
  referenceCode?: string | null;
  notes?: string | null;
  createdAt: string;
};

export type InventoryMovementPage = {
  items: InventoryMovementDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type AdminUserDto = {
  id: string;
  email: string;
  fullName: string;
  role: "Customer" | "Administrator" | "Employee";
  isActive: boolean;
  createdAt: string;
};

export type AdminUserAuditLogDto = {
  id: string;
  action: string;
  actorEmail: string;
  actorFullName: string;
  actorRole: string;
  targetUserId: string;
  targetEmail: string;
  targetFullName: string;
  details?: string | null;
  createdAt: string;
};

export type PagedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type AdminUsersSearchParams = {
  query?: string;
  role?: "Administrator" | "Employee" | "Customer";
  isActive?: boolean;
  page?: number;
  pageSize?: number;
};

export type UserAuditSearchParams = {
  targetUserId?: string;
  action?: string;
  page?: number;
  pageSize?: number;
};

export type LowStockAlertDto = {
  productId: string;
  productName: string;
  sku: string;
  stock: number;
  minimumStock: number;
  isOutOfStock: boolean;
  createdAt: string;
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

export type CreateStorePayload = {
  name: string;
  code: string;
  address: string;
  district?: string;
  province?: string;
  department?: string;
  phone?: string;
  pickupInstructions?: string;
  isActive: boolean;
};

export type UpdateStorePayload = CreateStorePayload & {
  id: string;
};

export async function searchAdminProducts(params: AdminProductSearchParams = {}) {
  const { data } = await api.get("/products", {
    params: {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
      query: params.query || undefined,
      sortBy: params.sortBy ?? "newest",
    },
  });

  return data as ProductSearchPage;
}

export async function listProducts() {
  const data = await searchAdminProducts({ pageSize: 60, sortBy: "newest" });
  return data.items;
}

export async function createProduct(payload: ProductPayload) {
  const { data } = await api.post("/products", payload);
  return data as string;
}

export async function updateProduct(payload: ProductPayload & { id: string }) {
  await api.put(`/products/${payload.id}`, payload);
}

export async function setProductStatus(id: string, status: number) {
  await api.patch(`/products/${id}/status`, { id, status });
}

export async function deleteProduct(id: string) {
  await api.delete(`/products/${id}`);
}

export async function listCategories() {
  const { data } = await api.get("/categories");
  return data as CategoryDto[];
}

export async function createCategory(payload: Omit<CategoryDto, "id" | "createdAt">) {
  const { data } = await api.post("/categories", payload);
  return data as string;
}

export async function updateCategory(payload: Omit<CategoryDto, "createdAt">) {
  await api.put(`/categories/${payload.id}`, payload);
}

export async function deleteCategory(id: string) {
  await api.delete(`/categories/${id}`);
}

export async function setCategoryStatus(id: string, isActive: boolean) {
  await api.patch(`/categories/${id}/status`, { id, isActive });
}

export async function listUsers(params: AdminUsersSearchParams = {}) {
  const { data } = await api.get("/users", {
    params: {
      query: params.query || undefined,
      role: params.role || undefined,
      isActive: params.isActive,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
    },
  });

  return data as PagedResult<AdminUserDto>;
}

export async function listUserAudits(params: UserAuditSearchParams = {}) {
  const { data } = await api.get("/users/audit", {
    params: {
      targetUserId: params.targetUserId || undefined,
      action: params.action || undefined,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
    },
  });

  return data as PagedResult<AdminUserAuditLogDto>;
}

export async function createUser(payload: { email: string; fullName: string; password: string; role: "Administrator" | "Employee" | "Customer"; isActive: boolean }) {
  const { data } = await api.post("/users", payload);
  return data as string;
}

export async function updateUserProfile(id: string, payload: { email: string; fullName: string }) {
  await api.patch(`/users/${id}`, { id, ...payload });
}

export async function setUserRole(id: string, role: "Administrator" | "Employee" | "Customer") {
  await api.patch(`/users/${id}/role`, { id, role });
}

export async function setUserStatus(id: string, isActive: boolean) {
  await api.patch(`/users/${id}/status`, { id, isActive });
}

export async function resetUserPassword(id: string, newPassword: string) {
  await api.patch(`/users/${id}/password`, { id, newPassword });
}

export async function listBrands() {
  const { data } = await api.get("/brands");
  return data as BrandDto[];
}

export async function createBrand(payload: Omit<BrandDto, "id" | "createdAt">) {
  const { data } = await api.post("/brands", payload);
  return data as string;
}

export async function updateBrand(payload: Omit<BrandDto, "createdAt">) {
  await api.put(`/brands/${payload.id}`, payload);
}

export async function deleteBrand(id: string) {
  await api.delete(`/brands/${id}`);
}

export async function setBrandStatus(id: string, isActive: boolean) {
  await api.patch(`/brands/${id}/status`, { id, isActive });
}

export async function listPromotions() {
  const { data } = await api.get("/promotions");

  if (Array.isArray(data)) {
    return data as PromotionDto[];
  }

  if (data && typeof data === "object") {
    if ("items" in data && Array.isArray((data as { items?: unknown }).items)) {
      return (data as { items: PromotionDto[] }).items;
    }

    if ("data" in data && Array.isArray((data as { data?: unknown }).data)) {
      return (data as { data: PromotionDto[] }).data;
    }
  }

  return [];
}

export async function createPromotion(payload: Omit<PromotionDto, "id">) {
  const { data } = await api.post("/promotions", payload);
  return data as string;
}

export async function updatePromotion(payload: PromotionDto) {
  await api.put(`/promotions/${payload.id}`, payload);
}

export async function deletePromotion(id: string) {
  await api.delete(`/promotions/${id}`);
}

export async function duplicatePromotion(id: string) {
  const { data } = await api.post(`/promotions/${id}/duplicate`);
  return data as string;
}

export async function setPromotionStatus(id: string, isActive: boolean) {
  await api.patch(`/promotions/${id}/status`, { id, isActive });
}

export async function listBanners() {
  const { data } = await api.get("/banners/admin");

  if (Array.isArray(data)) {
    return data as BannerDto[];
  }

  if (data && typeof data === "object") {
    if ("items" in data && Array.isArray((data as { items?: unknown }).items)) {
      return (data as { items: BannerDto[] }).items;
    }

    if ("data" in data && Array.isArray((data as { data?: unknown }).data)) {
      return (data as { data: BannerDto[] }).data;
    }
  }

  return [];
}

export async function createBanner(payload: Omit<BannerDto, "id" | "createdAt">) {
  const { data } = await api.post("/banners", payload);
  return data as string;
}

export async function updateBanner(payload: Omit<BannerDto, "createdAt">) {
  await api.put(`/banners/${payload.id}`, payload);
}

export async function deleteBanner(id: string) {
  await api.delete(`/banners/${id}`);
}

export async function setBannerStatus(id: string, isActive: boolean) {
  await api.patch(`/banners/${id}/status`, { id, isActive });
}

export async function getProduct(id: string) {
  const { data } = await api.get(`/products/${id}`);
  return data as ProductAdminDto;
}

export async function searchAdminOrders(params: AdminOrderSearchParams = {}) {
  const { data } = await api.get("/orders/admin", {
    params: {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
      startDate: params.startDate || undefined,
      endDate: params.endDate || undefined,
      paymentStatus: params.paymentStatus || undefined,
      orderStatus: typeof params.orderStatus === "number" ? params.orderStatus : undefined,
      customerName: params.customerName || undefined,
      orderNumber: params.orderNumber || undefined,
    },
  });

  return data as OrderAdminSearchResultDto;
}

export async function searchAdminSales(params: AdminSalesSearchParams = {}) {
  const { data } = await api.get("/sales/admin", {
    params: {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
      startDate: params.startDate || undefined,
      endDate: params.endDate || undefined,
      product: params.product || undefined,
    },
  });

  return data as SaleAdminSearchResultDto;
}

function getDownloadFilename(disposition: string | undefined, fallback: string) {
  if (!disposition) return fallback;
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);
  const basicMatch = disposition.match(/filename="?([^";]+)"?/i);
  return basicMatch?.[1] ?? fallback;
}

async function downloadSalesFile(path: string, params: AdminSalesSearchParams, fallbackName: string) {
  const response = await api.get(path, {
    params: {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
      startDate: params.startDate || undefined,
      endDate: params.endDate || undefined,
      product: params.product || undefined,
    },
    responseType: "blob",
  });

  const fileName = getDownloadFilename(response.headers["content-disposition"], fallbackName);
  const blobUrl = window.URL.createObjectURL(response.data as Blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}

export async function exportAdminSalesExcel(params: AdminSalesSearchParams = {}) {
  await downloadSalesFile("/sales/admin/export/excel", params, "ventas.xlsx");
}

export async function exportAdminSalesPdf(params: AdminSalesSearchParams = {}) {
  await downloadSalesFile("/sales/admin/export/pdf", params, "ventas.pdf");
}

export async function sendSaleToSunat(orderId: string) {
  const { data } = await api.post(`/sales/admin/${orderId}/sunat/send`);
  return data as SendSaleToSunatResultDto;
}

async function downloadSunatOrderFile(path: string, fallbackName: string) {
  const response = await api.get(path, { responseType: "blob" });
  const fileName = getDownloadFilename(response.headers["content-disposition"], fallbackName);
  const blobUrl = window.URL.createObjectURL(response.data as Blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}

export async function downloadSaleSunatXml(orderId: string) {
  await downloadSunatOrderFile(`/sales/admin/${orderId}/sunat/xml`, `sunat-${orderId}.xml`);
}

export async function downloadSaleSunatCdr(orderId: string) {
  await downloadSunatOrderFile(`/sales/admin/${orderId}/sunat/cdr`, `cdr-${orderId}.zip`);
}

export async function getAdminOrder(id: string) {
  const { data } = await api.get(`/orders/admin/${id}`);
  return data as OrderAdminDetailDto;
}

export async function cancelAdminOrder(payload: { id: string; reason?: string }) {
  await api.patch(`/orders/admin/${payload.id}/cancel`, payload);
}

export async function reactivateAdminOrder(payload: { id: string; reason?: string }) {
  await api.patch(`/orders/admin/${payload.id}/reactivate`, payload);
}

export async function updateAdminOrderPaymentStatus(payload: { id: string; paymentStatus: string }) {
  await api.patch(`/orders/admin/${payload.id}/payment-status`, payload);
}

export async function sendOrderWhatsApp(payload: { id: string; messageType: "confirm" | "reject" }) {
  const { data } = await api.post(`/orders/admin/${payload.id}/whatsapp`, payload);
  return data as { message: string };
}

export async function searchInventoryMovements(params: AdminInventoryMovementsParams = {}) {
  const { data } = await api.get("/inventory/admin/movements", {
    params: {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
      query: params.query || undefined,
      startDate: params.startDate || undefined,
      endDate: params.endDate || undefined,
      storeId: params.storeId || undefined,
    },
  });

  return data as InventoryMovementPage;
}

export async function registerStockIn(payload: {
  storeId: string;
  productId: string;
  productVariantId?: string | null;
  quantity: number;
  supplierName?: string;
  referenceCode?: string;
  notes?: string;
}) {
  const { data } = await api.post("/inventory/admin/stock-in", payload);
  return data as InventoryMovementDto;
}

export async function registerStockOut(payload: {
  storeId: string;
  productId: string;
  productVariantId?: string | null;
  quantity: number;
  referenceCode?: string;
  notes: string;
}) {
  const { data } = await api.post("/inventory/admin/stock-out", payload);
  return data as InventoryMovementDto;
}

export async function getLowStockAlerts(top = 30) {
  const { data } = await api.get("/inventory/admin/low-stock", {
    params: { top },
  });

  return data as LowStockAlertDto[];
}

export async function listStores(activeOnly = false) {
  const { data } = await api.get("/stores", {
    params: {
      activeOnly,
    },
  });

  return data as StoreLocationDto[];
}

export async function uploadAdminImage(file: File, scope: UploadScope) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("scope", scope);

  const { data } = await api.post("/uploads/image", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  const payload = data as { url?: string };
  if (!payload?.url) {
    throw new Error("No se pudo obtener la URL de la imagen subida.");
  }

  return payload.url;
}

export async function createStore(payload: CreateStorePayload) {
  const { data } = await api.post("/stores", payload);
  return data as string;
}

export async function updateStore(payload: UpdateStorePayload) {
  await api.put(`/stores/${payload.id}`, payload);
}

// ─── Store Settings ────────────────────────────────────────────────────────

export type ShippingSettingsDto = {
  freeShippingLima: boolean;
  provinceShippingCost: number;
};

export type TaxSettingsDto = {
  activeTaxType: "IGV" | "IVA";
  igvRate: number;
  ivaRate: number;
  taxIncludedInPrice: boolean;
};

export type CompanySettingsDto = {
  companyRuc: string;
  companyBusinessName: string;
  storeName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
};

export type PaymentSettingsDto = {
  paymentGatewayEnabled: boolean;
  yapeApiKey?: string;
  yapeSecretKey?: string;
  yapeMerchantId?: string;
  yapeWebhookSecret?: string;
  cardPublicKey?: string;
  cardSecretKey?: string;
  cardWebhookSecret?: string;
  cardProvider?: string;
  orderNotificationEmail: string;
  smtpHost?: string;
  smtpPort: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpUseSsl: boolean;
  smtpFromEmail?: string;
  smtpFromName?: string;
};

export type SunatSettingsDto = {
  sunatSolUser?: string;
  sunatSolPassword?: string;
  sunatCertificateFileName?: string;
  sunatServiceEndpoint?: string;
  sunatEnvironment: "development" | "production";
  sunatEstablishmentCode: string;
  sunatReceiptSeries: string;
  sunatInvoiceSeries: string;
  sunatReceiptNextCorrelative: number;
  sunatInvoiceNextCorrelative: number;
};

export type UpdateSunatSettingsPayload = SunatSettingsDto & {
  sunatCertificateBase64?: string;
  sunatCertificatePassword?: string;
  removeCertificate?: boolean;
};

export type WhatsAppSettingsDto = {
  whatsAppEnabled: boolean;
  whatsAppApiUrl?: string;
  whatsAppApiVersion?: string;
  whatsAppApiKey?: string;
  whatsAppSecretKey?: string;
  whatsAppPhoneNumberId?: string;
  whatsAppDefaultCountryCode?: string;
  whatsAppConfirmTemplate?: string;
  whatsAppRejectTemplate?: string;
};

export type StoreSettingsDto = {
  company: CompanySettingsDto;
  shipping: ShippingSettingsDto;
  tax: TaxSettingsDto;
  payment: PaymentSettingsDto;
  sunat: SunatSettingsDto;
  whatsApp: WhatsAppSettingsDto;
};

export type SendTestEmailPayload = {
  toEmail: string;
};

export type SendTestWhatsAppPayload = {
  toPhone: string;
  message: string;
};

export async function getStoreSettings(): Promise<StoreSettingsDto> {
  const { data } = await api.get("/settings");
  return data as StoreSettingsDto;
}

export async function updateShippingSettings(payload: ShippingSettingsDto): Promise<StoreSettingsDto> {
  const { data } = await api.put("/settings/shipping", payload);
  return data as StoreSettingsDto;
}

export async function updateTaxSettings(payload: TaxSettingsDto): Promise<StoreSettingsDto> {
  const { data } = await api.put("/settings/tax", payload);
  return data as StoreSettingsDto;
}

export async function updateCompanySettings(payload: CompanySettingsDto): Promise<StoreSettingsDto> {
  const { data } = await api.put("/settings/company", payload);
  return data as StoreSettingsDto;
}

export async function sendTestEmail(payload: SendTestEmailPayload): Promise<{ message: string }> {
  const { data } = await api.post("/settings/payment/test-email", payload);
  return data as { message: string };
}
export async function updatePaymentSettings(payload: PaymentSettingsDto): Promise<StoreSettingsDto> {
  const { data } = await api.put("/settings/payment", payload);
  return data as StoreSettingsDto;
}

export async function updateSunatSettings(payload: UpdateSunatSettingsPayload): Promise<StoreSettingsDto> {
  const { data } = await api.put("/settings/sunat", payload);
  return data as StoreSettingsDto;
}

export async function updateWhatsAppSettings(payload: WhatsAppSettingsDto): Promise<StoreSettingsDto> {
  const { data } = await api.put("/settings/whatsapp", payload);
  return data as StoreSettingsDto;
}

export async function sendTestWhatsApp(payload: SendTestWhatsAppPayload): Promise<{ message: string }> {
  const { data } = await api.post("/settings/whatsapp/test", payload);
  return data as { message: string };
}