using Ecommerce.Domain.Common;

namespace Ecommerce.Domain.Catalog;

public sealed class Promotion : AuditableEntity
{
    public required string Name { get; set; }
    public PromotionType Type { get; set; }
    public decimal Value { get; set; }
    public DateTimeOffset StartsAt { get; set; }
    public DateTimeOffset EndsAt { get; set; }
    public string? BannerUrl { get; set; }
    public Guid? ProductId { get; set; }
    public Guid? CategoryId { get; set; }
    public Guid? BrandId { get; set; }
    public bool IsActive { get; set; }
}