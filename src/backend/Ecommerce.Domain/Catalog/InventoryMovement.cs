using Ecommerce.Domain.Common;

namespace Ecommerce.Domain.Catalog;

public sealed class InventoryMovement : AuditableEntity
{
    public Guid StoreId { get; set; }
    public StoreLocation? Store { get; set; }
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
    public Guid? ProductVariantId { get; set; }
    public ProductVariant? ProductVariant { get; set; }
    public InventoryMovementType MovementType { get; set; } = InventoryMovementType.StockIn;
    public int Quantity { get; set; }
    public int StockBefore { get; set; }
    public int StockAfter { get; set; }
    public string? SupplierName { get; set; }
    public string? ReferenceCode { get; set; }
    public string? Notes { get; set; }
}
