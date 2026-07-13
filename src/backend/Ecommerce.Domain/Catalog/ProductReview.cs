using Ecommerce.Domain.Common;

namespace Ecommerce.Domain.Catalog;

public sealed class ProductReview : AuditableEntity
{
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
    public Guid CustomerId { get; set; }
    public int Rating { get; set; }
    public string Comment { get; set; } = string.Empty;
    public bool IsApproved { get; set; }
}