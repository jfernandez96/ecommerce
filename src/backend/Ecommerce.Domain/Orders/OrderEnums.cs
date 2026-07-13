namespace Ecommerce.Domain.Orders;

public enum OrderStatus
{
    Pending = 0,
    Paid = 1,
    Preparing = 2,
    Shipped = 3,
    Delivered = 4,
    Cancelled = 5,
    Returned = 6
}

public enum DocumentType
{
    Receipt = 0,
    Invoice = 1
}

public enum CustomerDocumentType
{
    Dni = 0,
    Ruc = 1,
    ForeignerCard = 2,
    Passport = 3,
    NoDomiciledTaxId = 4
}

public enum PaymentMethod
{
    Stripe = 0,
    MercadoPago = 1,
    Yape = 2,
    Plin = 3,
    BankTransfer = 4
}

public enum OrderFulfillmentType
{
    Shipping = 0,
    StorePickup = 1
}