using Ecommerce.Domain.Common;
using Ecommerce.Domain.Orders;

namespace Ecommerce.Domain.Sales;

public sealed class Sale : AuditableEntity
{
    public Guid? OrderId { get; set; }
    public string? OrderNumber { get; set; }
    public Guid? StoreId { get; set; }
    public string? StoreName { get; set; }
    public Guid? CustomerId { get; set; }
    public Guid? UserId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string? CustomerEmail { get; set; }
    public string? CustomerPhone { get; set; }
    public string? DocumentNumber { get; set; }
    public CustomerDocumentType CustomerDocumentType { get; set; } = CustomerDocumentType.Dni;
    public DocumentType DocumentType { get; set; } = DocumentType.Receipt;
    public string? SunatSeries { get; set; }
    public int? SunatCorrelative { get; set; }
    public string SunatStatus { get; set; } = "pending";
    public string? SunatStatusMessage { get; set; }
    public string? SunatTicket { get; set; }
    public string? SunatDigestValue { get; set; }
    public string? SunatXmlFileName { get; set; }
    public string? SunatXmlContent { get; set; }
    public string? SunatCdrFileName { get; set; }
    public string? SunatCdrContent { get; set; }
    public string? SunatRawResponse { get; set; }
    public string? SunatXmlStoragePath { get; set; }
    public string? SunatCdrStoragePath { get; set; }
    public DateTimeOffset? SunatSentAt { get; set; }
    public DateTimeOffset? SunatAcceptedAt { get; set; }
    public DateTimeOffset SaleDate { get; set; } = DateTimeOffset.UtcNow;
    public decimal Subtotal { get; set; }
    public decimal Discount { get; set; }
    public decimal Tax { get; set; }
    public string TaxType { get; set; } = "IGV";
    public decimal TaxRate { get; set; } = 18m;
    public bool TaxIncludedInPrice { get; set; } = true;
    public decimal Total { get; set; }
    public PaymentMethod PaymentMethod { get; set; }
    public SalePaymentStatus PaymentStatus { get; set; } = SalePaymentStatus.Pending;
    public SaleStatus SaleStatus { get; set; } = SaleStatus.PendingPayment;
    public string? PaymentReference { get; set; }
    public string? Observations { get; set; }
    public SaleDeliveryType DeliveryType { get; set; } = SaleDeliveryType.Shipping;
    public Guid? DepartmentId { get; set; }
    public Guid? ProvinceId { get; set; }
    public Guid? DistrictId { get; set; }
    public string? DepartmentName { get; set; }
    public string? ProvinceName { get; set; }
    public string? DistrictName { get; set; }
    public string? Address { get; set; }
    public string? Reference { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public decimal ShippingCost { get; set; }
    public SaleChannel SourceChannel { get; set; } = SaleChannel.Ecommerce;
    public List<SaleItem> Items { get; set; } = [];
}

public sealed class SaleItem : AuditableEntity
{
    public Guid SaleId { get; set; }
    public Sale? Sale { get; set; }
    public Guid ProductId { get; set; }
    public Guid? ProductVariantId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string Sku { get; set; } = string.Empty;
    public string? VariantDescription { get; set; }
    public int Quantity { get; set; }
    public decimal Price { get; set; }
    public decimal UnitPriceWithoutTax { get; set; }
    public decimal UnitPriceWithTax { get; set; }
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
    public decimal Discount { get; set; }
    public decimal Subtotal { get; set; }
    public decimal Tax { get; set; }
    public decimal Total { get; set; }
}