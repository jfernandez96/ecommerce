using Ecommerce.Domain.Catalog;
using Ecommerce.Domain.Common;

namespace Ecommerce.Domain.Customers;

public sealed class Wishlist : AuditableEntity
{
    public Guid? CustomerId { get; set; }
    public string CustomerEmail { get; set; } = string.Empty;
    public List<WishlistItem> Items { get; set; } = [];
}

public sealed class WishlistItem : AuditableEntity
{
    public Guid WishlistId { get; set; }
    public Wishlist? Wishlist { get; set; }
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
}
