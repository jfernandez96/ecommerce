using Ecommerce.Domain.Common;

namespace Ecommerce.Domain.Catalog;

public sealed class Category : AuditableEntity
{
    public required string Name { get; set; }
    public required string Slug { get; set; }
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public int SortOrder { get; set; }
    public Guid? ParentId { get; set; }
    public Category? Parent { get; set; }
    public List<Category> Children { get; set; } = [];
    public bool IsActive { get; set; } = true;
}