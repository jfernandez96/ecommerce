using Ecommerce.Domain.Common;

namespace Ecommerce.Domain.Catalog;

public sealed class ProductVariant : AuditableEntity
{
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
    public required string Sku { get; set; }
    public required string Color { get; set; }
    public required string Size { get; set; }
    public int Stock { get; set; }
    public decimal? PriceAdjustment { get; set; }
    public bool IsActive { get; set; } = true;
}