using Ecommerce.Domain.Common;

namespace Ecommerce.Domain.Catalog;

public sealed class ProductTag : AuditableEntity
{
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
    public required string Name { get; set; }
}