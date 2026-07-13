using Ecommerce.Domain.Common;

namespace Ecommerce.Domain.Catalog;

public sealed class ProductImage : AuditableEntity
{
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
    public required string Url { get; set; }
    public string AltText { get; set; } = string.Empty;
    public string? Color { get; set; }
    public int SortOrder { get; set; }
    public bool IsPrimary { get; set; }
}