using Dapper;
using Ecommerce.Application.Auth;
using Ecommerce.Application.Common;
using Ecommerce.Application.Users;
using Ecommerce.Domain.Catalog;
using Ecommerce.Domain.Common;
using Ecommerce.Domain.Customers;
using Ecommerce.Domain.Orders;
using Ecommerce.Domain.Sales;
using Ecommerce.Domain.Users;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace Ecommerce.Infrastructure.Persistence;

public sealed class UnitOfWork(AppDbContext dbContext) : IUnitOfWork
{
    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) => dbContext.SaveChangesAsync(cancellationToken);
}

public sealed class ProductRepository(AppDbContext dbContext) : IProductRepository
{
    public Task<Product?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        dbContext.Products
            .AsSplitQuery()
            .Include(x => x.Brand)
            .Include(x => x.Category)
            .Include(x => x.Images)
            .Include(x => x.Variants)
            .Include(x => x.Tags)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public Task<Product?> GetBySlugAsync(string slug, CancellationToken cancellationToken = default) =>
        dbContext.Products
            .AsSplitQuery()
            .Include(x => x.Brand)
            .Include(x => x.Category)
            .Include(x => x.Images)
            .Include(x => x.Variants)
            .Include(x => x.Tags)
            .FirstOrDefaultAsync(x => x.Slug == slug, cancellationToken);

    public async Task<IReadOnlyList<Product>> ListAsync(CancellationToken cancellationToken = default) =>
        await dbContext.Products
            .Include(x => x.Brand)
            .Include(x => x.Category)
            .Include(x => x.Images)
            .OrderByDescending(x => x.CreatedAt)
            .ToArrayAsync(cancellationToken);

    public Task AddAsync(Product product, CancellationToken cancellationToken = default) =>
        dbContext.Products.AddAsync(product, cancellationToken).AsTask();

    public async Task ReplaceImagesAsync(Guid productId, IReadOnlyList<ProductImage> images, CancellationToken cancellationToken = default)
    {
        var existingImages = await dbContext.ProductImages
            .IgnoreQueryFilters()
            .Where(image => image.ProductId == productId)
            .ToListAsync(cancellationToken);

        // Actualizar o crear imágenes
        for (int i = 0; i < images.Count; i++)
        {
            var newImage = images[i];
            var existing = existingImages.FirstOrDefault(img =>
                img.ProductId == productId &&
                img.Url == newImage.Url &&
                img.Color == newImage.Color);

            if (existing != null)
            {
                // Actualizar imagen existente
                existing.AltText = newImage.AltText;
                existing.IsPrimary = i == 0;
                existing.SortOrder = i;
                existing.IsDeleted = false;
            }
            else
            {
                // Crear nueva imagen
                newImage.SortOrder = i;
                await dbContext.ProductImages.AddAsync(newImage, cancellationToken);
            }
        }

        // Soft delete imágenes que existían pero no vienen en la petición
        foreach (var existing in existingImages)
        {
            var stillExists = images.Any(img =>
                img.Url == existing.Url &&
                img.Color == existing.Color);

            if (!stillExists && !existing.IsDeleted)
            {
                existing.IsDeleted = true;
            }
        }
    }

    public async Task ReplaceVariantsAsync(Guid productId, IReadOnlyList<ProductVariant> variants, CancellationToken cancellationToken = default)
    {
        var existingVariants = await dbContext.ProductVariants
            .IgnoreQueryFilters()
            .Where(variant => variant.ProductId == productId)
            .ToListAsync(cancellationToken);

        // Actualizar o crear variantes
        foreach (var newVariant in variants)
        {
            var existing = existingVariants.FirstOrDefault(v =>
                v.ProductId == productId &&
                v.Color.Equals(newVariant.Color, StringComparison.OrdinalIgnoreCase) &&
                v.Size.Equals(newVariant.Size, StringComparison.OrdinalIgnoreCase));

            if (existing != null)
            {
                // Actualizar variante existente
                existing.Sku = newVariant.Sku;
                existing.Stock = newVariant.Stock;
                existing.PriceAdjustment = newVariant.PriceAdjustment;
                existing.IsActive = newVariant.IsActive;
                existing.IsDeleted = false;
            }
            else
            {
                // Crear nueva variante
                await dbContext.ProductVariants.AddAsync(newVariant, cancellationToken);
            }
        }

        // Eliminar variantes que existían pero no vienen en la petición (soft delete)
        foreach (var existing in existingVariants)
        {
            var stillExists = variants.Any(v =>
                v.Color.Equals(existing.Color, StringComparison.OrdinalIgnoreCase) &&
                v.Size.Equals(existing.Size, StringComparison.OrdinalIgnoreCase));

            if (!stillExists && !existing.IsDeleted)
            {
                existing.IsDeleted = true;
            }
        }
    }

    public async Task<IReadOnlyList<LowStockAlertDto>> GetLowStockAlertsAsync(int top = 30, CancellationToken cancellationToken = default)
    {
        var limit = Math.Clamp(top, 1, 200);
        return await dbContext.Products
            .AsNoTracking()
            .Where(product => product.Status == ProductStatus.Active && product.Stock <= product.MinimumStock)
            .OrderBy(product => product.Stock)
            .ThenBy(product => product.Name)
            .Take(limit)
            .Select(product => new LowStockAlertDto(
                product.Id,
                product.Name,
                product.Sku,
                product.Stock,
                product.MinimumStock,
                product.Stock <= 0,
                product.CreatedAt))
            .ToArrayAsync(cancellationToken);
    }

    public void Remove(Product product) => dbContext.Products.Remove(product);
}

public sealed class InventoryMovementRepository(AppDbContext dbContext) : IInventoryMovementRepository
{
    public Task AddAsync(InventoryMovement movement, CancellationToken cancellationToken = default) =>
        dbContext.InventoryMovements.AddAsync(movement, cancellationToken).AsTask();

    public async Task<PagedResult<InventoryMovementDto>> SearchAsync(InventoryMovementSearchRequest request, CancellationToken cancellationToken = default)
    {
        var page = Math.Max(request.Page, 1);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);
        var offset = (page - 1) * pageSize;
        var query = dbContext.InventoryMovements
            .AsNoTracking()
            .Include(movement => movement.Product)
            .Include(movement => movement.ProductVariant)
            .AsQueryable();

        var search = request.Query?.Trim();
        var startDate = request.StartDate;
        var endDate = request.EndDate;

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(movement =>
                movement.Product!.Name.Contains(search)
                || movement.Product!.Sku.Contains(search)
                || (movement.ProductVariant != null && movement.ProductVariant.Sku.Contains(search))
                || (movement.ReferenceCode != null && movement.ReferenceCode.Contains(search))
                || (movement.SupplierName != null && movement.SupplierName.Contains(search)));
        }

        if (startDate.HasValue)
        {
            var start = AdminDateTime.ToUtcStartOfBusinessDay(startDate.Value);
            query = query.Where(movement => movement.CreatedAt >= start);
        }

        if (endDate.HasValue)
        {
            var end = AdminDateTime.ToUtcStartOfNextBusinessDay(endDate.Value);
            query = query.Where(movement => movement.CreatedAt < end);
        }

        var totalItems = await query.LongCountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(movement => movement.CreatedAt)
            .Skip(offset)
            .Take(pageSize)
            .Select(movement => new InventoryMovementDto(
                movement.Id,
                Guid.Empty,
                string.Empty,
                movement.ProductId,
                movement.ProductVariantId,
                movement.Product!.Name,
                movement.ProductVariant != null ? movement.ProductVariant.Sku : movement.Product!.Sku,
                movement.ProductVariant != null ? movement.ProductVariant.Color + " / " + movement.ProductVariant.Size : null,
                (int)movement.MovementType,
                movement.Quantity,
                movement.StockBefore,
                movement.StockAfter,
                movement.SupplierName,
                movement.ReferenceCode,
                movement.Notes,
                movement.CreatedAt))
            .ToArrayAsync(cancellationToken);

        return new PagedResult<InventoryMovementDto>(items, page, pageSize, totalItems);
    }
}

public sealed class CategoryRepository(AppDbContext dbContext) : ICategoryRepository
{
    public Task<Category?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        dbContext.Categories.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public async Task<IReadOnlyList<Category>> ListAsync(CancellationToken cancellationToken = default) =>
        await dbContext.Categories.OrderBy(x => x.SortOrder).ThenBy(x => x.Name).ToArrayAsync(cancellationToken);

    public Task AddAsync(Category category, CancellationToken cancellationToken = default) =>
        dbContext.Categories.AddAsync(category, cancellationToken).AsTask();

    public void Remove(Category category) => dbContext.Categories.Remove(category);
}

public sealed class BrandRepository(AppDbContext dbContext) : IBrandRepository
{
    public Task<Brand?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        dbContext.Brands.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public async Task<IReadOnlyList<Brand>> ListAsync(CancellationToken cancellationToken = default) =>
        await dbContext.Brands.OrderBy(x => x.Name).ToArrayAsync(cancellationToken);

    public Task AddAsync(Brand brand, CancellationToken cancellationToken = default) =>
        dbContext.Brands.AddAsync(brand, cancellationToken).AsTask();

    public void Remove(Brand brand) => dbContext.Brands.Remove(brand);
}

public sealed class PromotionRepository(AppDbContext dbContext) : IPromotionRepository
{
    public Task<Promotion?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        dbContext.Promotions.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public async Task<IReadOnlyList<Promotion>> ListAsync(CancellationToken cancellationToken = default) =>
        await dbContext.Promotions.OrderByDescending(x => x.StartsAt).ToArrayAsync(cancellationToken);

    public Task<int> CountActiveAsync(Guid? excludeId = null, CancellationToken cancellationToken = default) =>
        dbContext.Promotions.CountAsync(x => x.IsActive && (!excludeId.HasValue || x.Id != excludeId.Value), cancellationToken);

    public Task AddAsync(Promotion promotion, CancellationToken cancellationToken = default) =>
        dbContext.Promotions.AddAsync(promotion, cancellationToken).AsTask();

    public void Remove(Promotion promotion) => dbContext.Promotions.Remove(promotion);
}

public sealed class BannerRepository(AppDbContext dbContext) : IBannerRepository
{
    public Task<Banner?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        dbContext.Banners.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public async Task<IReadOnlyList<Banner>> ListAsync(bool activeOnly, CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow;
        var query = dbContext.Banners.AsQueryable();
        if (activeOnly)
        {
            query = query.Where(x => x.IsActive && (!x.StartsAt.HasValue || x.StartsAt <= now) && (!x.EndsAt.HasValue || x.EndsAt >= now));
        }

        return await query.OrderBy(x => x.SortOrder).ThenByDescending(x => x.CreatedAt).ToArrayAsync(cancellationToken);
    }

    public Task AddAsync(Banner banner, CancellationToken cancellationToken = default) =>
        dbContext.Banners.AddAsync(banner, cancellationToken).AsTask();

    public void Remove(Banner banner) => dbContext.Banners.Remove(banner);
}

public sealed class OrderRepository(AppDbContext dbContext) : IOrderRepository
{
    public Task AddAsync(Order order, CancellationToken cancellationToken = default) =>
        dbContext.Orders.AddAsync(order, cancellationToken).AsTask();

    public Task<Order?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        dbContext.Orders
            .Include(order => order.Items)
            .Include(order => order.Payments)
            .FirstOrDefaultAsync(order => order.Id == id, cancellationToken);

    public async Task<CustomerPromotionProfileDto> GetCustomerPromotionProfileAsync(string email, CancellationToken cancellationToken = default)
    {
        var normalizedEmail = (email ?? string.Empty).Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(normalizedEmail))
        {
            return new CustomerPromotionProfileDto(0, 0, 0m, null);
        }

        var customerOrders = dbContext.Orders
            .AsNoTracking()
            .Where(order => order.CustomerEmail.ToLower() == normalizedEmail && order.Status != OrderStatus.Cancelled);

        var totalOrders = await customerOrders.CountAsync(cancellationToken);
        if (totalOrders == 0)
        {
            return new CustomerPromotionProfileDto(0, 0, 0m, null);
        }

        var confirmedOrders = await customerOrders
            .CountAsync(order =>
                (order.Payments
                    .OrderByDescending(payment => payment.CreatedAt)
                    .Select(payment => payment.Status)
                    .FirstOrDefault() ?? "pending") == "confirmed", cancellationToken);

        var totalSpent = await customerOrders
            .Where(order =>
                (order.Payments
                    .OrderByDescending(payment => payment.CreatedAt)
                    .Select(payment => payment.Status)
                    .FirstOrDefault() ?? "pending") == "confirmed")
            .SumAsync(order => (decimal?)order.Total, cancellationToken) ?? 0m;

        var lastOrderAt = await customerOrders
            .OrderByDescending(order => order.CreatedAt)
            .Select(order => (DateTimeOffset?)order.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        return new CustomerPromotionProfileDto(totalOrders, confirmedOrders, totalSpent, lastOrderAt);
    }

    public async Task<PagedResult<OrderAdminListItemDto>> SearchAdminAsync(OrderAdminSearchRequest request, CancellationToken cancellationToken = default)
    {
        var page = Math.Max(request.Page, 1);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);
        var offset = (page - 1) * pageSize;
        var query = BuildAdminQuery(request);
        var total = await query.LongCountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(order => order.CreatedAt)
            .Skip(offset)
            .Take(pageSize)
            .Select(order => new OrderAdminListItemDto(
                order.Id,
                order.Number,
                Guid.Empty,
                string.Empty,
                "shipping",
                order.ShippingAddress.FullName,
                order.ShippingAddress.Phone,
                order.CustomerEmail,
                order.Items.Sum(item => item.Quantity),
                order.Total,
                (int)order.Status,
                (int)order.PaymentMethod,
                order.Payments.OrderByDescending(payment => payment.CreatedAt).Select(payment => payment.Status).FirstOrDefault() ?? "pending",
                order.Payments.OrderByDescending(payment => payment.CreatedAt).Select(payment => payment.Provider).FirstOrDefault() ?? "manual",
                order.CreatedAt))
            .ToArrayAsync(cancellationToken);

        return new PagedResult<OrderAdminListItemDto>(items, page, pageSize, total);
    }

    public async Task<OrderAdminDetailDto?> GetAdminDetailAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var order = await dbContext.Orders
            .AsNoTracking()
            .Include(current => current.Items)
            .Include(current => current.Payments)
            .FirstOrDefaultAsync(current => current.Id == id, cancellationToken);

        if (order is null) return null;

        var latestPayment = order.Payments
            .Where(payment => !payment.IsDeleted)
            .OrderByDescending(payment => payment.CreatedAt)
            .FirstOrDefault();

        return new OrderAdminDetailDto(
            order.Id,
            order.Number,
            Guid.Empty,
            string.Empty,
            "shipping",
            order.ShippingAddress.FullName,
            order.ShippingAddress.Phone,
            order.CustomerEmail,
            order.DocumentNumber,
            (int)order.DocumentType,
            (int)order.Status,
            (int)order.PaymentMethod,
            latestPayment?.Status ?? "pending",
            latestPayment?.Provider ?? "manual",
            order.Subtotal,
            order.Discount,
            order.Tax,
            order.Shipping,
            order.Total,
            order.TrackingCode,
            order.Notes,
            order.ShippingAddress.Line1,
            order.ShippingAddress.District,
            order.ShippingAddress.Province,
            order.ShippingAddress.Department,
            order.ShippingAddress.Reference,
            order.CreatedAt,
            order.Items
                .OrderBy(item => item.CreatedAt)
                .Select(item => new OrderAdminItemDto(item.Id, item.ProductId, item.ProductVariantId, item.ProductName, item.Sku, item.Color, item.Size, item.UnitPrice, item.Quantity, item.Total))
                .ToArray(),
            order.Payments
                .OrderByDescending(payment => payment.CreatedAt)
                .Select(payment => new OrderAdminPaymentDto(payment.Id, payment.Provider, payment.Status, payment.IntegrationMode, payment.Amount, payment.ExternalReference, payment.ExpiresAt, payment.CreatedAt))
                .ToArray());
    }

    public async Task<OrderAdminSummaryDto> GetAdminSummaryAsync(OrderAdminSearchRequest request, CancellationToken cancellationToken = default)
    {
        var query = BuildAdminQuery(request);
        var totalOrders = await query.LongCountAsync(cancellationToken);
        var confirmedRevenue = await query
            .Where(order => (order.Payments.OrderByDescending(payment => payment.CreatedAt).Select(payment => payment.Status).FirstOrDefault() ?? "pending") == "confirmed")
            .SumAsync(order => (decimal?)order.Total, cancellationToken) ?? 0m;
        var pendingPayments = await query.LongCountAsync(order =>
            (order.Payments.OrderByDescending(payment => payment.CreatedAt).Select(payment => payment.Status).FirstOrDefault() ?? "pending") == "pending"
            || (order.Payments.OrderByDescending(payment => payment.CreatedAt).Select(payment => payment.Status).FirstOrDefault() ?? "pending") == "pending_contact", cancellationToken);
        var confirmedPayments = await query.LongCountAsync(order =>
            (order.Payments.OrderByDescending(payment => payment.CreatedAt).Select(payment => payment.Status).FirstOrDefault() ?? "pending") == "confirmed", cancellationToken);
        var rejectedPayments = await query.LongCountAsync(order =>
            (order.Payments.OrderByDescending(payment => payment.CreatedAt).Select(payment => payment.Status).FirstOrDefault() ?? "pending") == "rejected", cancellationToken);
        var cancelledOrders = await query.LongCountAsync(order => order.Status == OrderStatus.Cancelled, cancellationToken);

        return new OrderAdminSummaryDto(totalOrders, confirmedRevenue, pendingPayments, confirmedPayments, rejectedPayments, cancelledOrders);
    }

    private IQueryable<Order> BuildAdminQuery(OrderAdminSearchRequest request)
    {
        var query = dbContext.Orders.AsNoTracking();
        var orderNumber = request.OrderNumber?.Trim();
        var customerName = request.CustomerName?.Trim();
        var paymentStatus = request.PaymentStatus?.Trim().ToLowerInvariant();
        var startDate = request.StartDate;
        var endDate = request.EndDate;

        if (!string.IsNullOrWhiteSpace(orderNumber))
        {
            query = query.Where(order => order.Number.Contains(orderNumber));
        }

        if (!string.IsNullOrWhiteSpace(customerName))
        {
            query = query.Where(order => order.ShippingAddress.FullName.Contains(customerName) || order.CustomerEmail.Contains(customerName));
        }

        if (request.OrderStatus.HasValue)
        {
            query = query.Where(order => (int)order.Status == request.OrderStatus.Value);
        }

        if (!string.IsNullOrWhiteSpace(paymentStatus))
        {
            query = query.Where(order => (order.Payments.OrderByDescending(payment => payment.CreatedAt).Select(payment => payment.Status).FirstOrDefault() ?? "pending") == paymentStatus);
        }

        if (startDate.HasValue)
        {
            var start = AdminDateTime.ToUtcStartOfBusinessDay(startDate.Value);
            query = query.Where(order => order.CreatedAt >= start);
        }

        if (endDate.HasValue)
        {
            var end = AdminDateTime.ToUtcStartOfNextBusinessDay(endDate.Value);
            query = query.Where(order => order.CreatedAt < end);
        }

        return query;
    }
}

public sealed class UserRepository(AppDbContext dbContext) : IUserRepository
{
    public Task<AppUser?> GetByEmailAsync(string email, CancellationToken cancellationToken = default) =>
        dbContext.Users
            .Include(user => user.RefreshTokens)
            .FirstOrDefaultAsync(x => x.Email == email, cancellationToken);

    public Task<AppUser?> GetByRefreshTokenHashAsync(string tokenHash, CancellationToken cancellationToken = default) =>
        dbContext.Users
            .Include(user => user.RefreshTokens)
            .FirstOrDefaultAsync(user => user.RefreshTokens.Any(token => token.TokenHash == tokenHash), cancellationToken);

    public Task<AppUser?> GetByIdWithRefreshTokensAsync(Guid userId, CancellationToken cancellationToken = default) =>
        dbContext.Users
            .Include(user => user.RefreshTokens)
            .FirstOrDefaultAsync(user => user.Id == userId, cancellationToken);

    public Task<AppUser?> GetByIdAsync(Guid userId, CancellationToken cancellationToken = default) =>
        dbContext.Users.FirstOrDefaultAsync(user => user.Id == userId, cancellationToken);

    public async Task<PagedResult<AppUser>> SearchAsync(UserListRequest request, CancellationToken cancellationToken = default)
    {
        var query = dbContext.Users.AsQueryable();

        if (!string.IsNullOrWhiteSpace(request.Query))
        {
            var normalized = request.Query.Trim().ToLowerInvariant();
            query = query.Where(user =>
                user.Email.ToLower().Contains(normalized) ||
                user.FullName.ToLower().Contains(normalized));
        }

        if (request.Role.HasValue)
        {
            query = query.Where(user => user.Role == request.Role.Value);
        }

        if (request.IsActive.HasValue)
        {
            query = query.Where(user => user.IsActive == request.IsActive.Value);
        }

        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);
        var totalItems = await query.LongCountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(user => user.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToArrayAsync(cancellationToken);

        return new PagedResult<AppUser>(items, page, pageSize, totalItems);
    }

    public Task<bool> ExistsByEmailAsync(string email, CancellationToken cancellationToken = default) =>
        dbContext.Users.AnyAsync(user => user.Email == email, cancellationToken);

    public Task AddAsync(AppUser user, CancellationToken cancellationToken = default) =>
        dbContext.Users.AddAsync(user, cancellationToken).AsTask();

    public Task AddRefreshTokenAsync(RefreshToken refreshToken, CancellationToken cancellationToken = default) =>
        dbContext.RefreshTokens.AddAsync(refreshToken, cancellationToken).AsTask();

    public Task AddUserAuditLogAsync(UserAuditLog log, CancellationToken cancellationToken = default) =>
        dbContext.UserAuditLogs.AddAsync(log, cancellationToken).AsTask();

    public async Task<PagedResult<UserAuditLog>> SearchUserAuditLogsAsync(UserAuditListRequest request, CancellationToken cancellationToken = default)
    {
        var query = dbContext.UserAuditLogs.AsQueryable();

        if (request.TargetUserId.HasValue)
        {
            query = query.Where(log => log.TargetUserId == request.TargetUserId.Value);
        }

        if (!string.IsNullOrWhiteSpace(request.Action))
        {
            var action = request.Action.Trim().ToLowerInvariant();
            query = query.Where(log => log.Action.ToLower() == action);
        }

        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);
        var totalItems = await query.LongCountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(log => log.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToArrayAsync(cancellationToken);

        return new PagedResult<UserAuditLog>(items, page, pageSize, totalItems);
    }
}

public sealed class ProductReadService(IConfiguration configuration) : IProductReadService
{
    public async Task<PagedResult<ProductSummaryDto>> SearchAsync(ProductSearchRequest request, CancellationToken cancellationToken = default)
    {
        await using var connection = new SqlConnection(configuration.GetConnectionString("SqlServer"));
        var page = Math.Max(request.Page, 1);
        var pageSize = Math.Clamp(request.PageSize, 1, 60);
        var offset = (page - 1) * pageSize;
        var sort = request.SortBy?.ToLowerInvariant() switch
        {
            "price" => "price.[EffectivePrice] asc",
            "price_desc" => "price.[EffectivePrice] desc",
            "newest" => "p.[CreatedAt] desc",
            _ => "p.[CreatedAt] desc"
        };

        var where = "where p.[IsDeleted] = 0 and p.[Status] = 1";
        var parameters = new DynamicParameters(new { request.Query, request.CategoryId, request.BrandId, request.MinPrice, request.MaxPrice, Now = DateTimeOffset.UtcNow, Offset = offset, PageSize = pageSize });

        if (!string.IsNullOrWhiteSpace(request.Query)) where += " and (p.[Name] like '%' + @Query + '%' or p.[Sku] like '%' + @Query + '%')";
        if (request.CategoryId.HasValue) where += " and p.[CategoryId] = @CategoryId";
        if (request.BrandId.HasValue) where += " and p.[BrandId] = @BrandId";
        if (!string.IsNullOrWhiteSpace(request.Size)) where += " and exists (select 1 from [ProductVariants] pv where pv.[ProductId] = p.[Id] and pv.[IsDeleted] = 0 and pv.[IsActive] = 1 and pv.[Size] = @Size)";
        if (request.MinPrice.HasValue) where += " and price.[EffectivePrice] >= @MinPrice";
        if (request.MaxPrice.HasValue) where += " and price.[EffectivePrice] <= @MaxPrice";
        if (request.InStock == true) where += " and p.[Stock] > 0";
        if (request.OnSale == true) where += " and discount.[SalePrice] is not null and discount.[SalePrice] < p.[RegularPrice]";

        const string promotionApply = """
                outer apply (
                    select top 1 cast(case
                        when promo.[Type] = 0 then round(p.[RegularPrice] * (1 - (promo.[Value] / 100.0)), 2)
                        when promo.[Type] = 1 then p.[RegularPrice] - promo.[Value]
                        else p.[RegularPrice]
                    end as decimal(18,2)) as [PromotionPrice]
                    from [Promotions] promo
                    where promo.[IsDeleted] = 0
                      and promo.[IsActive] = 1
                      and @Now >= promo.[StartsAt]
                      and @Now <= promo.[EndsAt]
                      and (
                          promo.[ProductId] = p.[Id]
                          or (promo.[ProductId] is null and promo.[CategoryId] = p.[CategoryId])
                          or (promo.[ProductId] is null and promo.[CategoryId] is null and promo.[BrandId] = p.[BrandId])
                          or (promo.[ProductId] is null and promo.[CategoryId] is null and promo.[BrandId] is null)
                      )
                    order by cast(case
                        when promo.[Type] = 0 then round(p.[RegularPrice] * (1 - (promo.[Value] / 100.0)), 2)
                        when promo.[Type] = 1 then p.[RegularPrice] - promo.[Value]
                        else p.[RegularPrice]
                    end as decimal(18,2)) asc
                ) promo
                outer apply (
                    select case
                        when promo.[PromotionPrice] is not null and p.[SalePrice] is not null then iif(promo.[PromotionPrice] < p.[SalePrice], promo.[PromotionPrice], p.[SalePrice])
                        when promo.[PromotionPrice] is not null then promo.[PromotionPrice]
                        else p.[SalePrice]
                    end as [SalePrice]
                ) discount
                outer apply (
                    select case when discount.[SalePrice] is not null and discount.[SalePrice] > 0 and discount.[SalePrice] < p.[RegularPrice] then discount.[SalePrice] else p.[RegularPrice] end as [EffectivePrice]
                ) price
            """;

        var sql = $"""
                 select p.[Id], p.[Name], p.[Slug], p.[Sku], p.[Description], b.[Name] as [Brand], c.[Name] as [Category], p.[RegularPrice], cast(case when discount.[SalePrice] is not null and discount.[SalePrice] > 0 and discount.[SalePrice] < p.[RegularPrice] then discount.[SalePrice] else null end as decimal(18,2)) as [SalePrice], p.[Stock],
                     isnull((select top 1 pi.[Url] from [ProductImages] pi where pi.[ProductId] = p.[Id] and pi.[IsDeleted] = 0 order by pi.[IsPrimary] desc, pi.[SortOrder] asc), '') as [ImageUrl],
                     isnull((select avg(cast(pr.[Rating] as float)) from [ProductReviews] pr where pr.[ProductId] = p.[Id] and pr.[IsApproved] = 1 and pr.[IsDeleted] = 0), 0) as [Rating],
                     cast(case when discount.[SalePrice] is not null and discount.[SalePrice] > 0 and discount.[SalePrice] < p.[RegularPrice] then 1 else 0 end as bit) as [IsOnSale],
                     nullif((select top 1 pv.[Size] from [ProductVariants] pv where pv.[ProductId] = p.[Id] and pv.[IsDeleted] = 0 and pv.[IsActive] = 1 order by pv.[CreatedAt] asc), '') as [Size],
                     nullif((
                         select string_agg(variantSizes.[Size], ',')
                         from (
                             select distinct pv.[Size]
                             from [ProductVariants] pv
                             where pv.[ProductId] = p.[Id]
                               and pv.[IsDeleted] = 0
                               and pv.[IsActive] = 1
                               and pv.[Stock] > 0
                               and nullif(ltrim(rtrim(pv.[Size])), '') is not null
                         ) variantSizes
                     ), '') as [SizesCsv],
                     isnull((
                         select count(1)
                         from [ProductVariants] pv
                         where pv.[ProductId] = p.[Id]
                           and pv.[IsDeleted] = 0
                           and pv.[IsActive] = 1
                     ), 0) as [VariantCount],
                     isnull((
                         select count(distinct pv.[Color])
                         from [ProductVariants] pv
                         where pv.[ProductId] = p.[Id]
                           and pv.[IsDeleted] = 0
                           and pv.[IsActive] = 1
                           and nullif(ltrim(rtrim(pv.[Color])), '') is not null
                     ), 0) as [DistinctColorCount],
                     isnull((
                         select count(distinct pv.[Size])
                         from [ProductVariants] pv
                         where pv.[ProductId] = p.[Id]
                           and pv.[IsDeleted] = 0
                           and pv.[IsActive] = 1
                           and nullif(ltrim(rtrim(pv.[Size])), '') is not null
                     ), 0) as [DistinctSizeCount]
                 from [Products] p
                inner join [Marca] b on b.[Id] = p.[BrandId]
                inner join [Categoria] c on c.[Id] = p.[CategoryId]
            {promotionApply}
            {where}
            order by {sort}
                 offset @Offset rows fetch next @PageSize rows only;

            select count(1)
                 from [Products] p
                inner join [Marca] b on b.[Id] = p.[BrandId]
                inner join [Categoria] c on c.[Id] = p.[CategoryId]
            {promotionApply}
            {where};
            """;

        using var grid = await connection.QueryMultipleAsync(new CommandDefinition(sql, parameters, cancellationToken: cancellationToken));
        var items = (await grid.ReadAsync<ProductSummaryDto>()).ToArray();
        var total = await grid.ReadSingleAsync<long>();
        return new PagedResult<ProductSummaryDto>(items, page, pageSize, total);
    }
}

public sealed class StoreLocationRepository(AppDbContext dbContext) : IStoreLocationRepository
{
    public Task<StoreLocation?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        dbContext.StoreLocations.FirstOrDefaultAsync(store => store.Id == id, cancellationToken);

    public async Task<IReadOnlyList<StoreLocation>> ListAsync(bool activeOnly, CancellationToken cancellationToken = default)
    {
        var query = dbContext.StoreLocations.AsQueryable();
        if (activeOnly)
        {
            query = query.Where(store => store.IsActive);
        }

        return await query
            .OrderBy(store => store.Name)
            .ToArrayAsync(cancellationToken);
    }

    public Task AddAsync(StoreLocation store, CancellationToken cancellationToken = default) =>
        dbContext.StoreLocations.AddAsync(store, cancellationToken).AsTask();

    public async Task<ProductStoreStock> GetOrCreateProductStockAsync(Guid storeId, Guid productId, CancellationToken cancellationToken = default)
    {
        var stock = await dbContext.ProductStoreStocks
            .FirstOrDefaultAsync(item => item.StoreId == storeId && item.ProductId == productId, cancellationToken);

        if (stock is not null)
        {
            return stock;
        }

        stock = new ProductStoreStock
        {
            StoreId = storeId,
            ProductId = productId,
            Stock = 0,
        };

        await dbContext.ProductStoreStocks.AddAsync(stock, cancellationToken);
        return stock;
    }

    public async Task<IReadOnlyList<ProductStoreStockDto>> GetProductStocksAsync(Guid productId, CancellationToken cancellationToken = default)
    {
        return await dbContext.ProductStoreStocks
            .AsNoTracking()
            .Include(item => item.Store)
            .Where(item => item.ProductId == productId && item.Store != null && item.Store.IsActive)
            .OrderByDescending(item => item.Stock)
            .ThenBy(item => item.Store!.Name)
            .Select(item => new ProductStoreStockDto(
                item.StoreId,
                item.Store!.Name,
                item.Store.Code,
                item.Stock,
                item.Store.IsActive))
            .ToArrayAsync(cancellationToken);
    }
}

public sealed class StoreSettingsRepository(AppDbContext dbContext) : IStoreSettingsRepository
{
    public async Task<StoreSettings> GetOrCreateAsync(CancellationToken cancellationToken = default)
    {
        var settings = await dbContext.StoreSettings.FirstOrDefaultAsync(cancellationToken);
        if (settings is not null) return settings;

        settings = new StoreSettings();
        dbContext.StoreSettings.Add(settings);
        await dbContext.SaveChangesAsync(cancellationToken);
        return settings;
    }
}

public sealed class ClaimBookRepository(AppDbContext dbContext) : IClaimBookRepository
{
    public Task AddAsync(ClaimBookEntry entry, CancellationToken cancellationToken = default) =>
        dbContext.ClaimBookEntries.AddAsync(entry, cancellationToken).AsTask();
}

public sealed class WishlistRepository(AppDbContext dbContext) : IWishlistRepository
{
    public Task<Wishlist?> GetByEmailAsync(string email, CancellationToken cancellationToken = default) =>
        dbContext.Wishlists
            .Include(x => x.Items)
            .ThenInclude(x => x.Product!)
            .ThenInclude(x => x.Brand)
            .Include(x => x.Items)
            .ThenInclude(x => x.Product!)
            .ThenInclude(x => x.Images)
            .FirstOrDefaultAsync(x => x.CustomerEmail == email, cancellationToken);

    public Task<Wishlist?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        dbContext.Wishlists
            .Include(x => x.Items)
            .ThenInclude(x => x.Product!)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public Task<bool> IsProductInWishlistAsync(Guid wishlistId, Guid productId, CancellationToken cancellationToken = default) =>
        dbContext.WishlistItems
            .AnyAsync(x => x.WishlistId == wishlistId && x.ProductId == productId && !x.IsDeleted, cancellationToken);

    public Task AddAsync(Wishlist wishlist, CancellationToken cancellationToken = default) =>
        dbContext.Wishlists.AddAsync(wishlist, cancellationToken).AsTask();
}

public sealed class SaleRepository(AppDbContext dbContext) : ISaleRepository
{
    public Task AddAsync(Sale sale, CancellationToken cancellationToken = default) =>
        dbContext.Sales.AddAsync(sale, cancellationToken).AsTask();

    public Task<Sale?> GetByOrderIdAsync(Guid orderId, CancellationToken cancellationToken = default) =>
        dbContext.Sales
            .Include(sale => sale.Items)
            .FirstOrDefaultAsync(sale => sale.OrderId == orderId, cancellationToken);

    public async Task<PagedResult<SaleAdminItemDto>> SearchAdminAsync(SaleAdminSearchRequest request, CancellationToken cancellationToken = default)
    {
        var page = Math.Max(request.Page, 1);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);
        var offset = (page - 1) * pageSize;
        var query = BuildAdminQuery(request);
        var total = await query.LongCountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(item => item.Sale!.SaleDate)
            .ThenByDescending(item => item.Sale!.OrderNumber)
            .Skip(offset)
            .Take(pageSize)
            .Select(item => new SaleAdminItemDto(
                item.Sale!.OrderId ?? Guid.Empty,
                item.Sale.OrderNumber ?? string.Empty,
                null,
                null,
                item.Sale.SunatSeries,
                item.Sale.SunatCorrelative,
                item.Sale.SunatStatus,
                item.Sale.SunatStatusMessage,
                item.ProductId,
                item.ProductVariantId,
                item.ProductName,
                item.Sku,
                item.VariantDescription,
                item.Sale.CustomerName,
                item.Sale.CustomerEmail ?? string.Empty,
                item.Quantity,
                item.Price,
                item.Total,
                item.Sale.Total,
                item.Sale.SaleStatus == SaleStatus.Confirmed
                    ? 1
                    : item.Sale.SaleStatus == SaleStatus.InFulfillment
                        ? 2
                        : item.Sale.SaleStatus == SaleStatus.Cancelled
                            ? 5
                            : item.Sale.SaleStatus == SaleStatus.Returned
                                ? 6
                                : 0,
                (int)item.Sale.PaymentMethod,
                item.Sale.PaymentStatus == SalePaymentStatus.Confirmed
                    ? "confirmed"
                    : item.Sale.PaymentStatus == SalePaymentStatus.Rejected
                        ? "rejected"
                        : item.Sale.PaymentStatus == SalePaymentStatus.Cancelled
                            ? "cancelled"
                            : "pending",
                item.Sale.SaleDate))
            .ToArrayAsync(cancellationToken);

        return new PagedResult<SaleAdminItemDto>(items, page, pageSize, total);
    }

    public async Task<IReadOnlyList<SaleAdminItemDto>> ListAdminAsync(SaleAdminSearchRequest request, CancellationToken cancellationToken = default)
    {
        return await BuildAdminQuery(request)
            .OrderByDescending(item => item.Sale!.SaleDate)
            .ThenByDescending(item => item.Sale!.OrderNumber)
            .Select(item => new SaleAdminItemDto(
                item.Sale!.OrderId ?? Guid.Empty,
                item.Sale.OrderNumber ?? string.Empty,
                null,
                null,
                item.Sale.SunatSeries,
                item.Sale.SunatCorrelative,
                item.Sale.SunatStatus,
                item.Sale.SunatStatusMessage,
                item.ProductId,
                item.ProductVariantId,
                item.ProductName,
                item.Sku,
                item.VariantDescription,
                item.Sale.CustomerName,
                item.Sale.CustomerEmail ?? string.Empty,
                item.Quantity,
                item.Price,
                item.Total,
                item.Sale.Total,
                item.Sale.SaleStatus == SaleStatus.Confirmed
                    ? 1
                    : item.Sale.SaleStatus == SaleStatus.InFulfillment
                        ? 2
                        : item.Sale.SaleStatus == SaleStatus.Cancelled
                            ? 5
                            : item.Sale.SaleStatus == SaleStatus.Returned
                                ? 6
                                : 0,
                (int)item.Sale.PaymentMethod,
                item.Sale.PaymentStatus == SalePaymentStatus.Confirmed
                    ? "confirmed"
                    : item.Sale.PaymentStatus == SalePaymentStatus.Rejected
                        ? "rejected"
                        : item.Sale.PaymentStatus == SalePaymentStatus.Cancelled
                            ? "cancelled"
                            : "pending",
                item.Sale.SaleDate))
            .ToArrayAsync(cancellationToken);
    }

    private IQueryable<SaleItem> BuildAdminQuery(SaleAdminSearchRequest request)
    {
        var product = request.Product?.Trim();
        var startDate = request.StartDate;
        var endDate = request.EndDate;

        var query = dbContext.SaleItems
            .AsNoTracking()
            .Where(item => item.Sale != null)
            .Where(item => item.Sale!.PaymentStatus == SalePaymentStatus.Confirmed)
            .Where(item => item.Sale!.SaleStatus != SaleStatus.Cancelled && item.Sale!.SaleStatus != SaleStatus.Returned)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(product))
        {
            query = query.Where(item => item.ProductName.Contains(product) || item.Sku.Contains(product));
        }

        if (startDate.HasValue)
        {
            var start = AdminDateTime.ToUtcStartOfBusinessDay(startDate.Value);
            query = query.Where(item => item.Sale!.SaleDate >= start);
        }

        if (endDate.HasValue)
        {
            var end = AdminDateTime.ToUtcStartOfNextBusinessDay(endDate.Value);
            query = query.Where(item => item.Sale!.SaleDate < end);
        }

        return query;
    }
}