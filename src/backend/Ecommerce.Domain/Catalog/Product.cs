using Ecommerce.Domain.Common;

namespace Ecommerce.Domain.Catalog;

public sealed class Product : AuditableEntity
{
    public required string Name { get; set; }
    public required string Slug { get; set; }
    public required string Sku { get; set; }
    public required string Code { get; set; }
    public string Description { get; set; } = string.Empty;
    public string LongDescription { get; set; } = string.Empty;
    public Guid BrandId { get; set; }
    public Brand? Brand { get; set; }
    public Guid CategoryId { get; set; }
    public Category? Category { get; set; }
    public Guid? SubcategoryId { get; set; }
    public Category? Subcategory { get; set; }
    public Guid? MainStoreId { get; set; }
    public decimal RegularPrice { get; set; }
    public decimal? SalePrice { get; set; }
    public decimal Cost { get; set; }
    public int Stock { get; set; }
    public int MinimumStock { get; set; } = 5;
    public decimal WeightKg { get; set; }
    public string Material { get; set; } = string.Empty;
    public ProductStatus Status { get; set; } = ProductStatus.Draft;
    public ProductGender Gender { get; set; } = ProductGender.Unisex;
    public string? VideoUrl { get; set; }
    public string SeoTitle { get; set; } = string.Empty;
    public string SeoDescription { get; set; } = string.Empty;
    public string CanonicalUrl { get; set; } = string.Empty;
    public List<ProductVariant> Variants { get; set; } = [];
    public List<ProductImage> Images { get; set; } = [];
    public List<ProductTag> Tags { get; set; } = [];
    public List<ProductReview> Reviews { get; set; } = [];
    public List<ProductStoreStock> StoreStocks { get; set; } = [];

    public decimal EffectivePrice => SalePrice is > 0 && SalePrice < RegularPrice ? SalePrice.Value : RegularPrice;
    public bool IsOnSale => EffectivePrice < RegularPrice;
    public bool IsAvailable => Status == ProductStatus.Active && Stock > 0;
}