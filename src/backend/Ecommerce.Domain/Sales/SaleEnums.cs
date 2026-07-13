namespace Ecommerce.Domain.Sales;

public enum SalePaymentStatus
{
    Pending = 0,
    Confirmed = 1,
    Rejected = 2,
    Cancelled = 3,
    Refunded = 4
}

public enum SaleStatus
{
    PendingPayment = 0,
    Confirmed = 1,
    InFulfillment = 2,
    Cancelled = 3,
    Returned = 4
}

public enum SaleChannel
{
    Ecommerce = 0,
    Admin = 1,
    Pos = 2
}

public enum SaleDeliveryType
{
    Shipping = 0,
    Pickup = 1
}