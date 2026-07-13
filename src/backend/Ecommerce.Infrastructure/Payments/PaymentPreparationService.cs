using Ecommerce.Application.Common;
using Ecommerce.Domain.Orders;
using Microsoft.Extensions.Configuration;

namespace Ecommerce.Infrastructure.Payments;

public sealed class PaymentPreparationService(IConfiguration configuration) : IPaymentPreparationService
{
    public Task<PaymentPreparationResult> PrepareAsync(Order order, CancellationToken cancellationToken = default)
    {
        var reference = $"{order.Number}-{Guid.NewGuid():N}"[..30];

        return Task.FromResult(order.PaymentMethod switch
        {
            PaymentMethod.Yape => PrepareYape(reference, order.Total),
            _ => PrepareStripe(reference)
        });
    }

    private PaymentPreparationResult PrepareStripe(string reference)
    {
        var publishableKey = configuration["Payments:Stripe:PublishableKey"];
        var secretKey = configuration["Payments:Stripe:SecretKey"];
        var isConfigured = !string.IsNullOrWhiteSpace(publishableKey) && !string.IsNullOrWhiteSpace(secretKey);

        return new PaymentPreparationResult(
            Provider: "stripe",
            Status: isConfigured ? "ready_for_intent" : "pending_configuration",
            IntegrationMode: "server_payment_intent",
            ExternalReference: reference,
            PublicKey: publishableKey,
            ClientSecret: null,
            CheckoutUrl: null,
            QrCodeUrl: null,
            ExpiresAt: DateTimeOffset.UtcNow.AddMinutes(30),
            Instructions: isConfigured
                ? [
                    "Crear el PaymentIntent en servidor usando el total confirmado del pedido.",
                    "Confirmar el pago en frontend usando el client secret retornado por la pasarela.",
                    "Actualizar el pedido a pagado solamente desde webhook firmado de Stripe."
                ]
                : [
                    "Configura Payments:Stripe:PublishableKey en el frontend seguro.",
                    "Configura Payments:Stripe:SecretKey solo en el backend.",
                    "Confirma el pedido con webhook firmado antes de liberar despacho."
                ]);
    }

    private PaymentPreparationResult PrepareYape(string reference, decimal amount)
    {
        var merchantCode = configuration["Payments:Yape:MerchantCode"];
        var qrBaseUrl = configuration["Payments:Yape:QrBaseUrl"];
        var qrCodeUrl = string.IsNullOrWhiteSpace(qrBaseUrl)
            ? null
            : $"{qrBaseUrl.TrimEnd('/')}?reference={Uri.EscapeDataString(reference)}&amount={amount:0.00}";

        return new PaymentPreparationResult(
            Provider: "yape",
            Status: !string.IsNullOrWhiteSpace(merchantCode) ? "pending_customer_action" : "pending_configuration",
            IntegrationMode: "qr_or_deeplink",
            ExternalReference: reference,
            PublicKey: merchantCode,
            ClientSecret: null,
            CheckoutUrl: null,
            QrCodeUrl: qrCodeUrl,
            ExpiresAt: DateTimeOffset.UtcNow.AddMinutes(15),
            Instructions: !string.IsNullOrWhiteSpace(merchantCode)
                ? [
                    "Genera el QR o deep link desde backend con referencia unica por pedido.",
                    "Valida la confirmacion de pago con conciliacion server-to-server o webhook del agregador.",
                    "Marca el pedido como pagado solo despues de validar la operacion recibida."
                ]
                : [
                    "Configura Payments:Yape:MerchantCode para habilitar referencias operativas.",
                    "Configura Payments:Yape:QrBaseUrl si usaras QR dinamico o deep link.",
                    "No confirmes manualmente pagos Yape sin validacion del backend."
                ]);
    }
}