using Ecommerce.Domain.Common;

namespace Ecommerce.Domain.Orders;

public sealed class Order : AuditableEntity
{
    public required string Number { get; set; }
    public Guid StoreId { get; set; }
    public string StoreName { get; set; } = string.Empty;
    public OrderFulfillmentType FulfillmentType { get; set; } = OrderFulfillmentType.Shipping;
    public Guid? CustomerId { get; set; }
    public string CustomerEmail { get; set; } = string.Empty;
    public string DocumentNumber { get; set; } = string.Empty;
    public CustomerDocumentType CustomerDocumentType { get; set; } = CustomerDocumentType.Dni;
    public OrderStatus Status { get; set; } = OrderStatus.Pending;
    public PaymentMethod PaymentMethod { get; set; }
    public DocumentType DocumentType { get; set; }
    public decimal Subtotal { get; set; }
    public decimal Discount { get; set; }
    public decimal Tax { get; set; }
    public string TaxType { get; set; } = "IGV";
    public decimal TaxRate { get; set; } = 18m;
    public bool TaxIncludedInPrice { get; set; } = true;
    public decimal Shipping { get; set; }
    public decimal Total { get; set; }
    public string TrackingCode { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
    public Address ShippingAddress { get; set; } = new();
    public List<OrderItem> Items { get; set; } = [];
    public List<OrderPayment> Payments { get; set; } = [];
}

public sealed class OrderItem : AuditableEntity
{
    public Guid OrderId { get; set; }
    public Order? Order { get; set; }
    public Guid ProductId { get; set; }
    public Guid? ProductVariantId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string Sku { get; set; } = string.Empty;
    public string? Color { get; set; }
    public string? Size { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal UnitPriceWithoutTax { get; set; }
    public decimal UnitPriceWithTax { get; set; }
    public int Quantity { get; set; }
    public string TaxType { get; set; } = "IGV";
    public decimal TaxRate { get; set; } = 18m;
    public bool TaxIncludedInPrice { get; set; } = true;
    public string TaxAffectationCode { get; set; } = "10";
    public string TaxSchemeId { get; set; } = "1000";
    public string TaxSchemeName { get; set; } = "IGV";
    public string TaxTypeCode { get; set; } = "VAT";
    public decimal TaxableAmount { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal LineAmountWithoutTax { get; set; }
    public decimal LineAmountWithTax { get; set; }
    public decimal Total { get; set; }
}

public sealed class Address
{
    public string FullName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Line1 { get; set; } = string.Empty;
    public string District { get; set; } = string.Empty;
    public string Province { get; set; } = string.Empty;
    public string Department { get; set; } = string.Empty;
    public string Reference { get; set; } = string.Empty;
}