using Ecommerce.Domain.Catalog;
using Ecommerce.Domain.Common;
using Ecommerce.Domain.Customers;
using Ecommerce.Domain.Orders;
using Ecommerce.Domain.Sales;
using Ecommerce.Domain.Users;
using Ecommerce.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace Ecommerce.Infrastructure.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductImage> ProductImages => Set<ProductImage>();
    public DbSet<ProductVariant> ProductVariants => Set<ProductVariant>();
    public DbSet<ProductStoreStock> ProductStoreStocks => Set<ProductStoreStock>();
    public DbSet<InventoryMovement> InventoryMovements => Set<InventoryMovement>();
    public DbSet<ProductTag> ProductTags => Set<ProductTag>();
    public DbSet<ProductReview> ProductReviews => Set<ProductReview>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Brand> Brands => Set<Brand>();
    public DbSet<Promotion> Promotions => Set<Promotion>();
    public DbSet<Banner> Banners => Set<Banner>();
    public DbSet<Cart> Carts => Set<Cart>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderPayment> OrderPayments => Set<OrderPayment>();
    public DbSet<Sale> Sales => Set<Sale>();
    public DbSet<SaleItem> SaleItems => Set<SaleItem>();
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<UserAuditLog> UserAuditLogs => Set<UserAuditLog>();
    public DbSet<Wishlist> Wishlists => Set<Wishlist>();
    public DbSet<WishlistItem> WishlistItems => Set<WishlistItem>();
    public DbSet<ClaimBookEntry> ClaimBookEntries => Set<ClaimBookEntry>();
    public DbSet<StoreSettings> StoreSettings => Set<StoreSettings>();
    public DbSet<StoreLocation> StoreLocations => Set<StoreLocation>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Product>(entity =>
        {
            entity.HasIndex(x => x.Slug).IsUnique();
            entity.HasIndex(x => x.Sku).IsUnique();
            entity.HasIndex(x => new { x.Status, x.CategoryId, x.BrandId });
            entity.Property(x => x.RegularPrice).HasPrecision(18, 2);
            entity.Property(x => x.SalePrice).HasPrecision(18, 2);
            entity.Property(x => x.Cost).HasPrecision(18, 2);
            entity.HasOne<StoreLocation>().WithMany().HasForeignKey(x => x.MainStoreId).OnDelete(DeleteBehavior.SetNull);
            entity.HasQueryFilter(x => !x.IsDeleted);
        });

        modelBuilder.Entity<ProductStoreStock>(entity =>
        {
            entity.ToTable("ProductStoreStocks");
            entity.HasIndex(x => new { x.ProductId, x.StoreId }).IsUnique();
            entity.HasOne(x => x.Product).WithMany(x => x.StoreStocks).HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Store).WithMany().HasForeignKey(x => x.StoreId).OnDelete(DeleteBehavior.Restrict);
            entity.HasQueryFilter(x => !x.IsDeleted);
        });

        modelBuilder.Entity<Category>(entity =>
        {
            entity.ToTable("Categoria");
            entity.HasIndex(x => x.Slug).IsUnique();
            entity.HasMany(x => x.Children).WithOne(x => x.Parent).HasForeignKey(x => x.ParentId).OnDelete(DeleteBehavior.Restrict);
            entity.HasQueryFilter(x => !x.IsDeleted);
        });

        modelBuilder.Entity<Brand>(entity =>
        {
            entity.ToTable("Marca");
            entity.HasIndex(x => x.Slug).IsUnique();
            entity.HasQueryFilter(x => !x.IsDeleted);
        });

        modelBuilder.Entity<ProductVariant>(entity =>
        {
            entity.HasIndex(x => x.Sku).IsUnique();
            entity.Property(x => x.PriceAdjustment).HasPrecision(18, 2);
            entity.HasOne(x => x.Product).WithMany(x => x.Variants).HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
            entity.HasQueryFilter(x => !x.IsDeleted);
        });

        modelBuilder.Entity<InventoryMovement>(entity =>
        {
            entity.ToTable("InventoryMovements");
            entity.HasOne(x => x.Store).WithMany().HasForeignKey(x => x.StoreId).OnDelete(DeleteBehavior.Restrict);
            entity.Property(x => x.SupplierName).HasMaxLength(180);
            entity.Property(x => x.ReferenceCode).HasMaxLength(100);
            entity.Property(x => x.Notes).HasMaxLength(500);
            entity.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.ProductVariant).WithMany().HasForeignKey(x => x.ProductVariantId).OnDelete(DeleteBehavior.Restrict);
            entity.HasQueryFilter(x => !x.IsDeleted);
        });

        modelBuilder.Entity<ProductImage>().HasQueryFilter(x => !x.IsDeleted);
        modelBuilder.Entity<ProductTag>().HasQueryFilter(x => !x.IsDeleted);
        modelBuilder.Entity<ProductReview>().HasQueryFilter(x => !x.IsDeleted);
        modelBuilder.Entity<Promotion>().HasQueryFilter(x => !x.IsDeleted);
        modelBuilder.Entity<Banner>(entity =>
        {
            entity.HasIndex(x => new { x.Placement, x.IsActive, x.SortOrder });
            entity.HasQueryFilter(x => !x.IsDeleted);
        });
        modelBuilder.Entity<Cart>().HasQueryFilter(x => !x.IsDeleted);
        modelBuilder.Entity<CartItem>().HasQueryFilter(x => !x.IsDeleted);

        modelBuilder.Entity<Order>(entity =>
        {
            entity.ToTable("Orders");
            entity.HasIndex(x => x.Number).IsUnique();
            entity.OwnsOne(x => x.ShippingAddress);
            entity.Property(x => x.Subtotal).HasPrecision(18, 2);
            entity.Property(x => x.Discount).HasPrecision(18, 2);
            entity.Property(x => x.Tax).HasPrecision(18, 2);
            entity.Property(x => x.TaxType).HasMaxLength(10);
            entity.Property(x => x.TaxRate).HasPrecision(5, 2);
            entity.Property(x => x.Shipping).HasPrecision(18, 2);
            entity.Property(x => x.Total).HasPrecision(18, 2);
            entity.HasMany(x => x.Payments).WithOne(x => x.Order).HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
            entity.HasQueryFilter(x => !x.IsDeleted);
        });

        modelBuilder.Entity<OrderItem>(entity =>
        {
            entity.ToTable("OrderItems");
            entity.Property(x => x.UnitPrice).HasPrecision(18, 2);
            entity.Property(x => x.UnitPriceWithoutTax).HasPrecision(18, 2);
            entity.Property(x => x.UnitPriceWithTax).HasPrecision(18, 2);
            entity.Property(x => x.TaxType).HasMaxLength(10);
            entity.Property(x => x.TaxRate).HasPrecision(5, 2);
            entity.Property(x => x.TaxAffectationCode).HasMaxLength(10);
            entity.Property(x => x.TaxSchemeId).HasMaxLength(10);
            entity.Property(x => x.TaxSchemeName).HasMaxLength(20);
            entity.Property(x => x.TaxTypeCode).HasMaxLength(10);
            entity.Property(x => x.TaxableAmount).HasPrecision(18, 2);
            entity.Property(x => x.TaxAmount).HasPrecision(18, 2);
            entity.Property(x => x.LineAmountWithoutTax).HasPrecision(18, 2);
            entity.Property(x => x.LineAmountWithTax).HasPrecision(18, 2);
            entity.Property(x => x.Total).HasPrecision(18, 2);
            entity.HasQueryFilter(x => !x.IsDeleted);
        });

        modelBuilder.Entity<OrderPayment>(entity =>
        {
            entity.ToTable("OrderPayments");
            entity.Property(x => x.Amount).HasPrecision(18, 2);
            entity.HasQueryFilter(x => !x.IsDeleted);
        });

        modelBuilder.Entity<Sale>(entity =>
        {
            entity.ToTable("Sales");
            entity.HasIndex(x => x.OrderId)
                .IsUnique()
                .HasFilter("[OrderId] IS NOT NULL");
            entity.HasIndex(x => new { x.SaleDate, x.PaymentStatus, x.SaleStatus });
            entity.Property(x => x.OrderNumber).HasMaxLength(40);
            entity.Property(x => x.CustomerName).HasMaxLength(180);
            entity.Property(x => x.CustomerEmail).HasMaxLength(256);
            entity.Property(x => x.CustomerPhone).HasMaxLength(30);
            entity.Property(x => x.DocumentNumber).HasMaxLength(20);
            entity.Property(x => x.SunatSeries).HasMaxLength(10);
            entity.Property(x => x.SunatStatus).HasMaxLength(30);
            entity.Property(x => x.SunatStatusMessage).HasMaxLength(600);
            entity.Property(x => x.SunatTicket).HasMaxLength(80);
            entity.Property(x => x.SunatDigestValue).HasMaxLength(200);
            entity.Property(x => x.SunatXmlFileName).HasMaxLength(120);
            entity.Property(x => x.SunatCdrFileName).HasMaxLength(120);
            entity.Property(x => x.SunatXmlStoragePath).HasMaxLength(600);
            entity.Property(x => x.SunatCdrStoragePath).HasMaxLength(600);
            entity.Property(x => x.PaymentReference).HasMaxLength(100);
            entity.Property(x => x.DepartmentName).HasMaxLength(120);
            entity.Property(x => x.ProvinceName).HasMaxLength(140);
            entity.Property(x => x.DistrictName).HasMaxLength(160);
            entity.Property(x => x.Address).HasMaxLength(240);
            entity.Property(x => x.Reference).HasMaxLength(240);
            entity.Property(x => x.Subtotal).HasPrecision(18, 2);
            entity.Property(x => x.Discount).HasPrecision(18, 2);
            entity.Property(x => x.Tax).HasPrecision(18, 2);
            entity.Property(x => x.TaxType).HasMaxLength(10);
            entity.Property(x => x.TaxRate).HasPrecision(5, 2);
            entity.Property(x => x.Total).HasPrecision(18, 2);
            entity.Property(x => x.ShippingCost).HasPrecision(18, 2);
            entity.Property(x => x.Latitude).HasPrecision(10, 7);
            entity.Property(x => x.Longitude).HasPrecision(10, 7);
            entity.HasMany(x => x.Items).WithOne(x => x.Sale).HasForeignKey(x => x.SaleId).OnDelete(DeleteBehavior.Cascade);
            entity.HasQueryFilter(x => !x.IsDeleted);
        });

        modelBuilder.Entity<SaleItem>(entity =>
        {
            entity.ToTable("SaleItems");
            entity.HasIndex(x => x.ProductId);
            entity.Property(x => x.ProductName).HasMaxLength(180);
            entity.Property(x => x.Sku).HasMaxLength(90);
            entity.Property(x => x.VariantDescription).HasMaxLength(120);
            entity.Property(x => x.Price).HasPrecision(18, 2);
            entity.Property(x => x.UnitPriceWithoutTax).HasPrecision(18, 2);
            entity.Property(x => x.UnitPriceWithTax).HasPrecision(18, 2);
            entity.Property(x => x.TaxType).HasMaxLength(10);
            entity.Property(x => x.TaxRate).HasPrecision(5, 2);
            entity.Property(x => x.TaxAffectationCode).HasMaxLength(10);
            entity.Property(x => x.TaxSchemeId).HasMaxLength(10);
            entity.Property(x => x.TaxSchemeName).HasMaxLength(20);
            entity.Property(x => x.TaxTypeCode).HasMaxLength(10);
            entity.Property(x => x.TaxableAmount).HasPrecision(18, 2);
            entity.Property(x => x.TaxAmount).HasPrecision(18, 2);
            entity.Property(x => x.LineAmountWithoutTax).HasPrecision(18, 2);
            entity.Property(x => x.LineAmountWithTax).HasPrecision(18, 2);
            entity.Property(x => x.Discount).HasPrecision(18, 2);
            entity.Property(x => x.Subtotal).HasPrecision(18, 2);
            entity.Property(x => x.Tax).HasPrecision(18, 2);
            entity.Property(x => x.Total).HasPrecision(18, 2);
            entity.HasQueryFilter(x => !x.IsDeleted);
        });

        modelBuilder.Entity<AppUser>(entity =>
        {
            entity.ToTable("Users");
            entity.HasIndex(x => x.Email).IsUnique();
            entity.HasQueryFilter(x => !x.IsDeleted);
        });

        modelBuilder.Entity<Wishlist>(entity =>
        {
            entity.ToTable("Wishlist");
            entity.HasIndex(x => x.CustomerEmail);
            entity.HasMany(x => x.Items).WithOne(x => x.Wishlist).HasForeignKey(x => x.WishlistId).OnDelete(DeleteBehavior.Cascade);
            entity.HasQueryFilter(x => !x.IsDeleted);
        });

        modelBuilder.Entity<WishlistItem>(entity =>
        {
            entity.ToTable("WishlistItem");
            entity.HasIndex(x => new { x.WishlistId, x.ProductId }).IsUnique();
            entity.HasOne(x => x.Product).WithMany().OnDelete(DeleteBehavior.Cascade);
            entity.HasQueryFilter(x => !x.IsDeleted);
        });

        modelBuilder.Entity<ClaimBookEntry>(entity =>
        {
            entity.ToTable("ClaimBookEntries");
            entity.HasIndex(x => x.Code).IsUnique();
            entity.Property(x => x.ClaimedAmount).HasPrecision(18, 2);
            entity.HasQueryFilter(x => !x.IsDeleted);
        });

        modelBuilder.Entity<StoreSettings>(entity =>
        {
            entity.ToTable("StoreSettings");
            entity.Property(x => x.ProvinceShippingCost).HasPrecision(18, 2);
            entity.Property(x => x.ActiveTaxType).HasMaxLength(10);
            entity.Property(x => x.IgvRate).HasPrecision(5, 2);
            entity.Property(x => x.IvaRate).HasPrecision(5, 2);
            entity.Property(x => x.SunatSolUser).HasMaxLength(120);
            entity.Property(x => x.SunatSolPassword).HasMaxLength(120);
            entity.Property(x => x.SunatCertificateFileName).HasMaxLength(260);
            entity.Property(x => x.SunatCertificatePassword).HasMaxLength(120);
            entity.Property(x => x.SunatServiceEndpoint).HasMaxLength(400);
            entity.Property(x => x.SunatEnvironment).HasMaxLength(20);
            entity.Property(x => x.SunatEstablishmentCode).HasMaxLength(4);
            entity.Property(x => x.SunatReceiptSeries).HasMaxLength(10);
            entity.Property(x => x.SunatInvoiceSeries).HasMaxLength(10);
        });

        modelBuilder.Entity<StoreLocation>(entity =>
        {
            entity.ToTable("StoreLocations");
            entity.HasIndex(x => x.Code).IsUnique();
            entity.Property(x => x.Name).HasMaxLength(180);
            entity.Property(x => x.Code).HasMaxLength(50);
            entity.Property(x => x.Address).HasMaxLength(260);
            entity.Property(x => x.District).HasMaxLength(160);
            entity.Property(x => x.Province).HasMaxLength(140);
            entity.Property(x => x.Department).HasMaxLength(120);
            entity.Property(x => x.Phone).HasMaxLength(30);
            entity.Property(x => x.PickupInstructions).HasMaxLength(400);
            entity.HasQueryFilter(x => !x.IsDeleted);
        });

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.ToTable("RefreshTokens");
            entity.HasIndex(x => x.UserId);
            entity.Property(x => x.TokenHash).HasMaxLength(128);
            entity.Property(x => x.ReplacedByTokenHash).HasMaxLength(128);
            entity.HasQueryFilter(x => !x.IsDeleted);
        });

        modelBuilder.Entity<UserAuditLog>(entity =>
        {
            entity.ToTable("UserAuditLogs");
            entity.HasIndex(x => new { x.TargetUserId, x.CreatedAt });
            entity.HasIndex(x => new { x.ActorUserId, x.CreatedAt });
            entity.HasIndex(x => new { x.Action, x.CreatedAt });
            entity.Property(x => x.ActorEmail).HasMaxLength(256);
            entity.Property(x => x.ActorFullName).HasMaxLength(180);
            entity.Property(x => x.ActorRole).HasMaxLength(30);
            entity.Property(x => x.TargetEmail).HasMaxLength(256);
            entity.Property(x => x.TargetFullName).HasMaxLength(180);
            entity.Property(x => x.Action).HasMaxLength(80);
            entity.Property(x => x.Details).HasMaxLength(600);
            entity.HasOne<AppUser>()
                .WithMany()
                .HasForeignKey(x => x.ActorUserId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<AppUser>()
                .WithMany()
                .HasForeignKey(x => x.TargetUserId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasQueryFilter(x => !x.IsDeleted);
        });
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var businessNow = AdminDateTime.BusinessNow;

        foreach (var entry in ChangeTracker.Entries<AuditableEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = businessNow;
                entry.Entity.UpdatedAt = null;
            }

            if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = businessNow;
            }
        }

        return base.SaveChangesAsync(cancellationToken);
    }
}