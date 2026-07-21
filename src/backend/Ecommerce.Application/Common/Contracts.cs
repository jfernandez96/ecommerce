using Ecommerce.Domain.Catalog;
using Ecommerce.Domain.Common;
using Ecommerce.Domain.Customers;
using Ecommerce.Domain.Orders;
using Ecommerce.Domain.Sales;

namespace Ecommerce.Application.Common;

public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

public interface IProductRepository
{
    Task<Product?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Product?> GetBySlugAsync(string slug, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Product>> ListAsync(CancellationToken cancellationToken = default);
    Task AddAsync(Product product, CancellationToken cancellationToken = default);
    Task ReplaceImagesAsync(Guid productId, IReadOnlyList<ProductImage> images, CancellationToken cancellationToken = default);
    Task ReplaceVariantsAsync(Guid productId, IReadOnlyList<ProductVariant> variants, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<LowStockAlertDto>> GetLowStockAlertsAsync(int top = 30, CancellationToken cancellationToken = default);
    void Remove(Product product);
}

public interface IInventoryMovementRepository
{
    Task AddAsync(InventoryMovement movement, CancellationToken cancellationToken = default);
    Task<PagedResult<InventoryMovementDto>> SearchAsync(InventoryMovementSearchRequest request, CancellationToken cancellationToken = default);
}

public interface IStoreLocationRepository
{
    Task<StoreLocation?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StoreLocation>> ListAsync(bool activeOnly, CancellationToken cancellationToken = default);
    Task AddAsync(StoreLocation store, CancellationToken cancellationToken = default);
    Task<ProductStoreStock> GetOrCreateProductStockAsync(Guid storeId, Guid productId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ProductStoreStockDto>> GetProductStocksAsync(Guid productId, CancellationToken cancellationToken = default);
}

public interface ICategoryRepository
{
    Task<Category?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Category>> ListAsync(CancellationToken cancellationToken = default);
    Task AddAsync(Category category, CancellationToken cancellationToken = default);
    void Remove(Category category);
}

public interface IBrandRepository
{
    Task<Brand?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Brand>> ListAsync(CancellationToken cancellationToken = default);
    Task AddAsync(Brand brand, CancellationToken cancellationToken = default);
    void Remove(Brand brand);
}

public interface IOrderRepository
{
    Task AddAsync(Order order, CancellationToken cancellationToken = default);
    Task<Order?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<CustomerPromotionProfileDto> GetCustomerPromotionProfileAsync(string email, CancellationToken cancellationToken = default);
    Task<PagedResult<OrderAdminListItemDto>> SearchAdminAsync(OrderAdminSearchRequest request, CancellationToken cancellationToken = default);
    Task<OrderAdminDetailDto?> GetAdminDetailAsync(Guid id, CancellationToken cancellationToken = default);
    Task<OrderAdminSummaryDto> GetAdminSummaryAsync(OrderAdminSearchRequest request, CancellationToken cancellationToken = default);
}

public interface ISaleRepository
{
    Task AddAsync(Sale sale, CancellationToken cancellationToken = default);
    Task<Sale?> GetByOrderIdAsync(Guid orderId, CancellationToken cancellationToken = default);
    Task<PagedResult<SaleAdminItemDto>> SearchAdminAsync(SaleAdminSearchRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SaleAdminItemDto>> ListAdminAsync(SaleAdminSearchRequest request, CancellationToken cancellationToken = default);
}

public interface ISalesExportService
{
    byte[] BuildExcel(SalesExportDocumentDto document);
    byte[] BuildPdf(SalesExportDocumentDto document);
}

public interface ISunatInvoiceService
{
    Task<SunatSubmissionResult> SubmitSaleAsync(Sale sale, Ecommerce.Domain.Common.StoreSettings settings, CancellationToken cancellationToken = default);
}

public interface IPromotionRepository
{
    Task<Promotion?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Promotion>> ListAsync(CancellationToken cancellationToken = default);
    Task<int> CountActiveAsync(Guid? excludeId = null, CancellationToken cancellationToken = default);
    Task AddAsync(Promotion promotion, CancellationToken cancellationToken = default);
    void Remove(Promotion promotion);
}

public interface IBannerRepository
{
    Task<Banner?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Banner>> ListAsync(bool activeOnly, CancellationToken cancellationToken = default);
    Task AddAsync(Banner banner, CancellationToken cancellationToken = default);
    void Remove(Banner banner);
}

public interface IProductReadService
{
    Task<PagedResult<ProductSummaryDto>> SearchAsync(ProductSearchRequest request, CancellationToken cancellationToken = default);
}

public interface IJwtTokenService
{
    TokenResponse CreateToken(Guid userId, string email, string fullName, string role);
    string HashRefreshToken(string refreshToken);
    DateTimeOffset GetRefreshTokenExpiresAt();
}

public interface IPasswordHasher
{
    string Hash(string password);
    bool Verify(string password, string passwordHash);
}

public interface IStoreSettingsRepository
{
    Task<Ecommerce.Domain.Common.StoreSettings> GetOrCreateAsync(CancellationToken cancellationToken = default);
}

public interface IClaimBookRepository
{
    Task AddAsync(ClaimBookEntry entry, CancellationToken cancellationToken = default);
}

public interface IPaymentPreparationService
{
    Task<PaymentPreparationResult> PrepareAsync(Order order, CancellationToken cancellationToken = default);
}

public interface IOrderNotificationService
{
    Task SendOrderReceivedEmailAsync(Order order, string recipientEmail, CancellationToken cancellationToken = default);
    Task SendSmtpTestEmailAsync(string recipientEmail, CancellationToken cancellationToken = default);
}

public interface IWhatsAppNotificationService
{
    Task SendOrderDecisionMessageAsync(Order order, string decision, CancellationToken cancellationToken = default);
    Task SendTestMessageAsync(string toPhone, string message, CancellationToken cancellationToken = default);
}

public interface IIntegrationClientSecurityService
{
    Task<IntegrationClientAccessResult> AuthorizeAsync(string? clientId, string? apiKey, string scope, CancellationToken cancellationToken = default);
}

public interface IIntegrationAuditService
{
    Task WriteAsync(IntegrationAuditEntry entry, CancellationToken cancellationToken = default);
}

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, long TotalItems)
{
    public int TotalPages => (int)Math.Ceiling(TotalItems / (double)Math.Max(PageSize, 1));
}

public sealed record ProductSearchRequest(
    string? Query,
    Guid? CategoryId,
    Guid? BrandId,
    string? Color,
    string? Size,
    decimal? MinPrice,
    decimal? MaxPrice,
    bool? InStock,
    bool? OnSale,
    string? SortBy,
    int Page = 1,
    int PageSize = 24);

public sealed record ProductSummaryDto(
    Guid Id,
    string Name,
    string Slug,
    string Sku,
    string Description,
    string Brand,
    string Category,
    decimal RegularPrice,
    decimal? SalePrice,
    int Stock,
    string ImageUrl,
    double Rating,
    bool IsOnSale,
    string? Size,
    string? SizesCsv,
    int VariantCount,
    int DistinctColorCount,
    int DistinctSizeCount);

public sealed record ProductDetailDto(
    Guid Id,
    string Name,
    string Slug,
    string Sku,
    string Code,
    string Brand,
    string Category,
    string Description,
    string LongDescription,
    decimal RegularPrice,
    decimal? SalePrice,
    int Stock,
    decimal WeightKg,
    string Material,
    string? VideoUrl,
    IReadOnlyList<ProductImageDto> Images,
    IReadOnlyList<ProductVariantDto> Variants,
    IReadOnlyList<string> Tags,
    IReadOnlyList<ProductStoreStockDto> StoreStocks);

public sealed record ProductImageDto(string Url, string AltText, bool IsPrimary, string? Color);
public sealed record ProductVariantDto(Guid Id, string Sku, string Color, string Size, int Stock, decimal? PriceAdjustment);
public sealed record TokenResponse(string AccessToken, string RefreshToken, DateTimeOffset ExpiresAt);
public sealed record ProductAdminDto(Guid Id, string Name, string Slug, string Sku, string Code, Guid BrandId, Guid CategoryId, Guid? SubcategoryId, Guid? MainStoreId, decimal RegularPrice, decimal? SalePrice, decimal Cost, int Stock, int MinimumStock, decimal WeightKg, string Material, string Description, string LongDescription, string? VideoUrl, string SeoTitle, string SeoDescription, int Status, IReadOnlyList<ProductImageDto> Images, IReadOnlyList<ProductVariantDto> Variants);
public sealed record PaymentPreparationResult(string Provider, string Status, string IntegrationMode, string ExternalReference, string? PublicKey, string? ClientSecret, string? CheckoutUrl, string? QrCodeUrl, DateTimeOffset? ExpiresAt, IReadOnlyList<string> Instructions);
public sealed record PaymentPreparationDto(Guid PaymentId, string Provider, string Status, string IntegrationMode, string ExternalReference, string? PublicKey, string? ClientSecret, string? CheckoutUrl, string? QrCodeUrl, DateTimeOffset? ExpiresAt, IReadOnlyList<string> Instructions);
public sealed record CustomerPromotionProfileDto(int TotalOrders, int ConfirmedOrders, decimal TotalSpent, DateTimeOffset? LastOrderAt);
public sealed record CouponValidationResultDto(bool IsValid, string Message, decimal DiscountAmount, decimal FinalSubtotal, string? PromotionName, string? PromotionType);
public sealed record IntegrationWhatsAppDispatchResultDto(string Status, string ClientId, string Message, string? ExternalId, DateTimeOffset SentAt);
public sealed record IntegrationClientAccessResult(bool IsAllowed, string? ClientId, int? RetryAfterSeconds, string ErrorCode, string Message);
public sealed record IntegrationAuditEntry(
    DateTimeOffset Timestamp,
    string Channel,
    string Scope,
    string? ClientId,
    string? SourceSystem,
    string? ExternalId,
    string? ToPhone,
    string Status,
    string Detail,
    string? IpAddress,
    string? UserAgent);
public sealed record OrderCheckoutResultDto(Guid OrderId, string OrderNumber, string Status, decimal Total, Guid StoreId, string StoreName, string FulfillmentType, PaymentPreparationDto Payment);
public sealed record OrderAdminSearchRequest(string? OrderNumber, string? CustomerName, string? PaymentStatus, int? OrderStatus, DateOnly? StartDate, DateOnly? EndDate, int Page = 1, int PageSize = 20);
public sealed record OrderAdminListItemDto(Guid Id, string Number, Guid StoreId, string StoreName, string FulfillmentType, string CustomerName, string CustomerPhone, string CustomerEmail, int ItemCount, decimal Total, int Status, int PaymentMethod, string PaymentStatus, string PaymentProvider, DateTimeOffset CreatedAt);
public sealed record OrderAdminItemDto(Guid Id, Guid ProductId, Guid? ProductVariantId, string ProductName, string Sku, string? Color, string? Size, decimal UnitPrice, int Quantity, decimal Total);
public sealed record OrderAdminPaymentDto(Guid Id, string Provider, string Status, string IntegrationMode, decimal Amount, string? ExternalReference, DateTimeOffset? ExpiresAt, DateTimeOffset CreatedAt);
public sealed record OrderAdminDetailDto(Guid Id, string Number, Guid StoreId, string StoreName, string FulfillmentType, string CustomerName, string CustomerPhone, string CustomerEmail, string DocumentNumber, int DocumentType, int Status, int PaymentMethod, string PaymentStatus, string PaymentProvider, decimal Subtotal, decimal Discount, decimal Tax, decimal Shipping, decimal Total, string TrackingCode, string Notes, string AddressLine1, string District, string Province, string Department, string Reference, DateTimeOffset CreatedAt, IReadOnlyList<OrderAdminItemDto> Items, IReadOnlyList<OrderAdminPaymentDto> Payments);
public sealed record OrderAdminSummaryDto(long TotalOrders, decimal ConfirmedRevenue, long PendingPayments, long ConfirmedPayments, long RejectedPayments, long CancelledOrders);
public sealed record OrderAdminSearchResultDto(PagedResult<OrderAdminListItemDto> Page, OrderAdminSummaryDto Summary);
public sealed record SaleAdminSearchRequest(string? Product, DateOnly? StartDate, DateOnly? EndDate, int Page = 1, int PageSize = 20);
public sealed record SaleAdminItemDto(Guid OrderId, string OrderNumber, Guid? StoreId, string? StoreName, string? SunatSeries, int? SunatCorrelative, string SunatStatus, string? SunatStatusMessage, Guid ProductId, Guid? ProductVariantId, string ProductName, string Sku, string? VariantLabel, string CustomerName, string CustomerEmail, int Quantity, decimal UnitPrice, decimal LineTotal, decimal OrderTotal, int OrderStatus, int PaymentMethod, string PaymentStatus, DateTimeOffset SaleDate);
public sealed record SaleAdminSummaryDto(decimal GrossSales, long TotalOrders, long TotalLines, long UnitsSold);
public sealed record SaleDailyPointDto(string DateLabel, decimal GrossSales, long Orders, long UnitsSold);
public sealed record TopSellingProductDto(Guid ProductId, string ProductName, string Sku, long UnitsSold, decimal Revenue, long Orders);
public sealed record SaleAdminDashboardDto(IReadOnlyList<SaleDailyPointDto> DailySales, IReadOnlyList<TopSellingProductDto> TopProducts);
public sealed record SaleAdminSearchResultDto(PagedResult<SaleAdminItemDto> Page, SaleAdminSummaryDto Summary, SaleAdminDashboardDto Dashboard);
public sealed record SalesExportDocumentDto(string Title, DateOnly? StartDate, DateOnly? EndDate, string? ProductFilter, SaleAdminSummaryDto Summary, SaleAdminDashboardDto Dashboard, IReadOnlyList<SaleAdminItemDto> Items);
public sealed record ExportedFileDto(byte[] Content, string ContentType, string FileName);
public sealed record SunatSubmissionResult(
    string Status,
    string Message,
    string XmlFileName,
    string SignedXml,
    string? Ticket,
    string? DigestValue,
    DateTimeOffset SentAt,
    DateTimeOffset? AcceptedAt,
    string? RawResponse,
    string? CdrFileName,
    string? CdrXmlContent,
    string? XmlStoragePath,
    string? CdrStoragePath);
public sealed record InventoryMovementSearchRequest(string? Query, Guid? StoreId, DateOnly? StartDate, DateOnly? EndDate, int Page = 1, int PageSize = 20);
public sealed record InventoryMovementDto(Guid Id, Guid StoreId, string StoreName, Guid ProductId, Guid? ProductVariantId, string ProductName, string ProductSku, string? VariantLabel, int MovementType, int Quantity, int StockBefore, int StockAfter, string? SupplierName, string? ReferenceCode, string? Notes, DateTimeOffset CreatedAt);
public sealed record LowStockAlertDto(Guid ProductId, string ProductName, string Sku, int Stock, int MinimumStock, bool IsOutOfStock, DateTimeOffset CreatedAt);
public sealed record ProductStoreStockDto(Guid StoreId, string StoreName, string StoreCode, int Stock, bool IsPickupEnabled);
public sealed record StoreLocationDto(Guid Id, string Name, string Code, string Address, string? District, string? Province, string? Department, string? Phone, string? PickupInstructions, bool IsActive, DateTimeOffset CreatedAt);

public sealed record CategoryDto(Guid Id, string Name, string Slug, string? Description, string? ImageUrl, bool IsActive, int SortOrder, Guid? ParentId, DateTimeOffset CreatedAt);
public sealed record BrandDto(Guid Id, string Name, string Slug, string? LogoUrl, bool IsActive, DateTimeOffset CreatedAt);
public sealed record PromotionDto(Guid Id, string Name, string Type, decimal Value, DateTimeOffset StartsAt, DateTimeOffset EndsAt, string? BannerUrl, bool IsActive, Guid? ProductId, Guid? CategoryId, Guid? BrandId);
public sealed record BannerDto(Guid Id, string Title, string Subtitle, string ImageUrl, string? LinkUrl, string Placement, int SortOrder, DateTimeOffset? StartsAt, DateTimeOffset? EndsAt, bool IsActive, DateTimeOffset CreatedAt);