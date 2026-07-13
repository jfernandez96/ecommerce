using Ecommerce.Domain.Common;

namespace Ecommerce.Domain.Orders;

public sealed class Cart : AuditableEntity
{
    public Guid? CustomerId { get; set; }
    public string? GuestToken { get; set; }
    public string? CouponCode { get; set; }
    public List<CartItem> Items { get; set; } = [];
}

public sealed class CartItem : AuditableEntity
{
    public Guid CartId { get; set; }
    public Cart? Cart { get; set; }
    public Guid ProductId { get; set; }
    public Guid? ProductVariantId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string Sku { get; set; } = string.Empty;
    public string ImageUrl { get; set; } = string.Empty;
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; }
}