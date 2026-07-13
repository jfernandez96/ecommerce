namespace Ecommerce.Domain.Common;

public sealed class StoreSettings : AuditableEntity
{
    // Company information (public footer)
    public string CompanyRuc { get; set; } = "20613512277";
    public string CompanyBusinessName { get; set; } = "Descosale E.I.R.L";
    public string StoreName { get; set; } = "Ecommerce";
    public string CompanyAddress { get; set; } = "Direccion pendiente";
    public string CompanyPhone { get; set; } = "+51 937211721";
    public string CompanyEmail { get; set; } = "descoaostv@gmail.com";

    // Shipping
    public bool FreeShippingLima { get; set; } = true;
    public decimal ProvinceShippingCost { get; set; } = 15m;

    // Taxes
    public string ActiveTaxType { get; set; } = "IGV";
    public decimal IgvRate { get; set; } = 18m;
    public decimal IvaRate { get; set; } = 12m;
    public bool TaxIncludedInPrice { get; set; } = true;

    // Payment gateway
    public bool PaymentGatewayEnabled { get; set; }

    // Yape
    public string? YapeApiKey { get; set; }
    public string? YapeSecretKey { get; set; }
    public string? YapeMerchantId { get; set; }
    public string? YapeWebhookSecret { get; set; }

    // Card (Stripe/MP compatible)
    public string? CardPublicKey { get; set; }
    public string? CardSecretKey { get; set; }
    public string? CardWebhookSecret { get; set; }
    public string? CardProvider { get; set; }  // "stripe" | "mercadopago"

    // Fallback notification email (used when gateway is disabled)
    public string OrderNotificationEmail { get; set; } = "jfernandez-20@hotmail.com";

    // SMTP (used to send order detail emails)
    public string? SmtpHost { get; set; }
    public int SmtpPort { get; set; } = 587;
    public string? SmtpUser { get; set; }
    public string? SmtpPassword { get; set; }
    public bool SmtpUseSsl { get; set; } = true;
    public string? SmtpFromEmail { get; set; }
    public string? SmtpFromName { get; set; }

    // SUNAT / e-invoicing
    public string? SunatSolUser { get; set; }
    public string? SunatSolPassword { get; set; }
    public string? SunatCertificateFileName { get; set; }
    public string? SunatCertificatePassword { get; set; }
    public string? SunatCertificateBase64 { get; set; }
    public string? SunatServiceEndpoint { get; set; }
    public string SunatEnvironment { get; set; } = "development";
    public string SunatEstablishmentCode { get; set; } = "0000";
    public string SunatReceiptSeries { get; set; } = "B001";
    public string SunatInvoiceSeries { get; set; } = "F001";
    public int SunatReceiptNextCorrelative { get; set; } = 1;
    public int SunatInvoiceNextCorrelative { get; set; } = 1;

    // WhatsApp Cloud API
    public bool WhatsAppEnabled { get; set; }
    public string? WhatsAppApiUrl { get; set; } = "https://graph.facebook.com";
    public string? WhatsAppApiVersion { get; set; } = "v21.0";
    public string? WhatsAppApiKey { get; set; }
    public string? WhatsAppSecretKey { get; set; }
    public string? WhatsAppPhoneNumberId { get; set; }
    public string? WhatsAppDefaultCountryCode { get; set; } = "51";
    public string? WhatsAppConfirmTemplate { get; set; } = "Hola {{customerName}}, tu pedido {{orderNumber}} ya esta en marcha. Total: S/ {{total}}. Gracias por comprar en {{storeName}}. Te escribimos por aqui cuando haya una nueva novedad.";
    public string? WhatsAppRejectTemplate { get; set; } = "Hola {{customerName}}, no pudimos validar el pago de tu pedido {{orderNumber}}. Si deseas, responde a este mensaje y lo resolvemos contigo lo antes posible.";
}
