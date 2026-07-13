using Ecommerce.Domain.Common;

namespace Ecommerce.Domain.Catalog;

public sealed class ProductStoreStock : AuditableEntity
{
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
    public Guid StoreId { get; set; }
    public StoreLocation? Store { get; set; }
    public int Stock { get; set; }
}
