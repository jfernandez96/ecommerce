using Ecommerce.Domain.Common;

namespace Ecommerce.Domain.Orders;

public sealed class OrderPayment : AuditableEntity
{
    public Guid OrderId { get; set; }
    public Order? Order { get; set; }
    public PaymentMethod Method { get; set; }
    public string Provider { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string IntegrationMode { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "PEN";
    public string ExternalReference { get; set; } = string.Empty;
    public string? PublicKey { get; set; }
    public string? ClientSecret { get; set; }
    public string? CheckoutUrl { get; set; }
    public string? QrCodeUrl { get; set; }
    public DateTimeOffset? ExpiresAt { get; set; }
    public string? MetadataJson { get; set; }
}