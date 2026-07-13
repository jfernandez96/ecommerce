namespace Ecommerce.Domain.Catalog;

public enum ProductStatus
{
    Draft = 0,
    Active = 1,
    Inactive = 2,
    Archived = 3
}

public enum ProductGender
{
    Unisex = 0,
    Men = 1,
    Women = 2,
    Kids = 3
}

public enum PromotionType
{
    Percentage = 0,
    FixedAmount = 1,
    TwoForOne = 2,
    ThreeForTwo = 3
}

public enum InventoryMovementType
{
    StockIn = 1,
    ReturnFromCancelledOrder = 2,
    ManualStockOut = 3
}