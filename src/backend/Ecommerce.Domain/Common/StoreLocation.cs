namespace Ecommerce.Domain.Common;

public sealed class StoreLocation : AuditableEntity
{
    public required string Name { get; set; }
    public required string Code { get; set; }
    public required string Address { get; set; }
    public string? District { get; set; }
    public string? Province { get; set; }
    public string? Department { get; set; }
    public string? Phone { get; set; }
    public string? PickupInstructions { get; set; }
    public bool IsActive { get; set; } = true;
}
