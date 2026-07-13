using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using Ecommerce.Application.Common;
using Ecommerce.Domain.Orders;
using Microsoft.Extensions.Logging;

namespace Ecommerce.Infrastructure.Notifications;

public sealed partial class WhatsAppNotificationService(
    IStoreSettingsRepository settingsRepository,
    ILogger<WhatsAppNotificationService> logger) : IWhatsAppNotificationService
{
    public Task SendOrderDecisionMessageAsync(Order order, string decision, CancellationToken cancellationToken = default)
    {
        var message = BuildOrderMessage;
        return SendInternalAsync(order.ShippingAddress.Phone, settings => message(settings, order, decision), cancellationToken);
    }

    public Task SendTestMessageAsync(string toPhone, string message, CancellationToken cancellationToken = default) =>
        SendInternalAsync(toPhone, _ => message, cancellationToken);

    private async Task SendInternalAsync(string toPhone, Func<Ecommerce.Domain.Common.StoreSettings, string> messageFactory, CancellationToken cancellationToken)
    {
        var settings = await settingsRepository.GetOrCreateAsync(cancellationToken);
        if (!settings.WhatsAppEnabled)
        {
            throw new InvalidOperationException("Activa la integracion de WhatsApp antes de enviar mensajes.");
        }

        var apiUrl = GetRequired(settings.WhatsAppApiUrl, "la URL base de WhatsApp");
        var apiVersion = GetRequired(settings.WhatsAppApiVersion, "la version de WhatsApp");
        var apiKey = GetRequired(settings.WhatsAppApiKey, "la API key de WhatsApp");
        var phoneNumberId = GetRequired(settings.WhatsAppPhoneNumberId, "el Phone Number ID de WhatsApp");
        var countryCode = GetRequired(settings.WhatsAppDefaultCountryCode, "el codigo de pais por defecto de WhatsApp");
        var normalizedPhone = NormalizePhone(toPhone, countryCode);
        var message = messageFactory(settings).Trim();
        var endpoint = $"{apiUrl.TrimEnd('/')}/{apiVersion.Trim('/')}/{phoneNumberId}/messages";

        using var httpClient = new HttpClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
        {
            Content = JsonContent.Create(new
            {
                messaging_product = "whatsapp",
                to = normalizedPhone,
                type = "text",
                text = new
                {
                    preview_url = false,
                    body = message
                }
            })
        };

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            logger.LogWarning("WhatsApp API error {StatusCode}: {Body}", (int)response.StatusCode, body);
            throw new InvalidOperationException("No se pudo enviar el mensaje de WhatsApp. Revisa la configuracion y credenciales.");
        }

        logger.LogInformation("WhatsApp message sent to {Phone}", normalizedPhone);
    }

    private static string BuildOrderMessage(Ecommerce.Domain.Common.StoreSettings settings, Order order, string decision)
    {
        var template = decision == "reject"
            ? settings.WhatsAppRejectTemplate
            : settings.WhatsAppConfirmTemplate;

        var message = string.IsNullOrWhiteSpace(template)
            ? (decision == "reject"
                ? "Hola {{customerName}}, no pudimos validar el pago de tu pedido {{orderNumber}}. Escribenos y lo revisamos contigo."
                : "Hola {{customerName}}, tu pedido {{orderNumber}} ya esta en marcha. Total: S/ {{total}}. Te mantendremos al tanto por aqui.")
            : template;

        return message
            .Replace("{{customerName}}", order.ShippingAddress.FullName, StringComparison.OrdinalIgnoreCase)
            .Replace("{{orderNumber}}", order.Number, StringComparison.OrdinalIgnoreCase)
            .Replace("{{total}}", order.Total.ToString("0.00"), StringComparison.OrdinalIgnoreCase)
            .Replace("{{storeName}}", settings.CompanyBusinessName, StringComparison.OrdinalIgnoreCase)
                .Replace("{{paymentStatus}}", decision == "reject" ? "en revision" : "aprobado", StringComparison.OrdinalIgnoreCase);
    }

    private static string NormalizePhone(string phone, string countryCode)
    {
        var digits = NonDigitsRegex().Replace(phone ?? string.Empty, string.Empty);
        if (string.IsNullOrWhiteSpace(digits))
        {
            throw new InvalidOperationException("La orden no tiene un telefono valido para WhatsApp.");
        }

        return digits.StartsWith(countryCode, StringComparison.Ordinal) ? digits : $"{countryCode}{digits}";
    }

    private static string GetRequired(string? value, string fieldName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new InvalidOperationException($"Configura {fieldName} antes de usar WhatsApp.");
        }

        return value;
    }

    [GeneratedRegex("[^0-9]")]
    private static partial Regex NonDigitsRegex();
}