using Ecommerce.Domain.Common;

namespace Ecommerce.Domain.Catalog;

public sealed class Banner : AuditableEntity
{
    public required string Title { get; set; }
    public string Subtitle { get; set; } = string.Empty;
    public required string ImageUrl { get; set; }
    public string? LinkUrl { get; set; }
    public string Placement { get; set; } = "home";
    public int SortOrder { get; set; }
    public DateTimeOffset? StartsAt { get; set; }
    public DateTimeOffset? EndsAt { get; set; }
    public bool IsActive { get; set; } = true;
}