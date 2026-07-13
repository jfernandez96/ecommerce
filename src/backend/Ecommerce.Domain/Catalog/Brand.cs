using Ecommerce.Domain.Common;

namespace Ecommerce.Domain.Catalog;

public sealed class Brand : AuditableEntity
{
    public required string Name { get; set; }
    public required string Slug { get; set; }
    public string? LogoUrl { get; set; }
    public bool IsActive { get; set; } = true;
}