using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Globalization;
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
        return SendOrderDecisionInternalAsync(order, decision, cancellationToken);
    }

    public Task SendTestMessageAsync(string toPhone, string message, CancellationToken cancellationToken = default) =>
        SendTextInternalAsync(toPhone, _ => message, cancellationToken);

    private async Task SendOrderDecisionInternalAsync(Order order, string decision, CancellationToken cancellationToken)
    {
        var settings = await settingsRepository.GetOrCreateAsync(cancellationToken);
        EnsureEnabled(settings);

        var templateValue = decision == "reject" ? settings.WhatsAppRejectTemplate : settings.WhatsAppConfirmTemplate;
        var toPhone = order.ShippingAddress.Phone;

        if (TryParseTemplateConfig(templateValue, out var config))
        {
            var normalizedPhone = NormalizePhone(toPhone, GetRequired(settings.WhatsAppDefaultCountryCode, "el codigo de pais por defecto de WhatsApp"));
            var endpoint = BuildEndpoint(settings);
            var parameters = BuildTemplateParameters(config.ParameterKeys, settings, order, decision);

            object payload;
            if (parameters.Length > 0)
            {
                payload = new
                {
                    messaging_product = "whatsapp",
                    to = normalizedPhone,
                    type = "text",
                    template = new
                    {
                        name = config.TemplateName,
                        language = new { code = config.LanguageCode },
                        components = new[]
                        {
                            new
                            {
                                type = "body",
                                parameters
                            }
                        }
                    }
                };
            }
            else
            {
                payload = new
                {
                    messaging_product = "whatsapp",
                    to = normalizedPhone,
                    type = "text",
                    template = new
                    {
                        name = config.TemplateName,
                        language = new { code = config.LanguageCode }
                    }
                };
            }

            await SendRequestAsync(endpoint, GetRequired(settings.WhatsAppApiKey, "la API key de WhatsApp"), normalizedPhone, payload, cancellationToken);
            return;
        }

        await SendTextInternalAsync(toPhone, s => BuildOrderMessage(s, order, decision), cancellationToken);
    }

    private async Task SendTextInternalAsync(string toPhone, Func<Ecommerce.Domain.Common.StoreSettings, string> messageFactory, CancellationToken cancellationToken)
    {
        var settings = await settingsRepository.GetOrCreateAsync(cancellationToken);
        EnsureEnabled(settings);

        var apiKey = GetRequired(settings.WhatsAppApiKey, "la API key de WhatsApp");
        var countryCode = GetRequired(settings.WhatsAppDefaultCountryCode, "el codigo de pais por defecto de WhatsApp");
        var normalizedPhone = NormalizePhone(toPhone, countryCode);
        var message = messageFactory(settings).Trim();
        var endpoint = BuildEndpoint(settings);

        var payload = new
        {
            messaging_product = "whatsapp",
            to = normalizedPhone,
            type = "text",
            text = new
            {
                preview_url = false,
                body = message
            }
        };

        await SendRequestAsync(endpoint, apiKey, normalizedPhone, payload, cancellationToken);
    }

    private async Task SendRequestAsync(string endpoint, string apiKey, string normalizedPhone, object payload, CancellationToken cancellationToken)
    {
        using var httpClient = new HttpClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
        {
            Content = JsonContent.Create(payload)
        };

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            logger.LogWarning("WhatsApp API error {StatusCode}: {Body}", (int)response.StatusCode, body);
            throw new InvalidOperationException($"No se pudo enviar el mensaje de WhatsApp. Codigo {(int)response.StatusCode}. Respuesta: {body}");
        }

        logger.LogInformation("WhatsApp message sent to {Phone}", normalizedPhone);
    }

    private static string BuildEndpoint(Ecommerce.Domain.Common.StoreSettings settings)
    {
        var apiUrl = GetRequired(settings.WhatsAppApiUrl, "la URL base de WhatsApp");
        var apiVersion = GetRequired(settings.WhatsAppApiVersion, "la version de WhatsApp");
        var phoneNumberId = GetRequired(settings.WhatsAppPhoneNumberId, "el Phone Number ID de WhatsApp");
        return $"{apiUrl.TrimEnd('/')}/{apiVersion.Trim('/')}/{phoneNumberId}/messages";
    }

    private static void EnsureEnabled(Ecommerce.Domain.Common.StoreSettings settings)
    {
        if (!settings.WhatsAppEnabled)
        {
            throw new InvalidOperationException("Activa la integracion de WhatsApp antes de enviar mensajes.");
        }
    }

    private static bool TryParseTemplateConfig(string? value, out (string TemplateName, string LanguageCode, string[] ParameterKeys) config)
    {
        config = default;
        if (string.IsNullOrWhiteSpace(value)) return false;

        var trimmed = value.Trim();
        if (!trimmed.StartsWith("template:", StringComparison.OrdinalIgnoreCase)) return false;

        var raw = trimmed["template:".Length..].Trim();
        if (string.IsNullOrWhiteSpace(raw)) return false;

        var pieces = raw.Split('|', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        if (pieces.Length == 0) return false;

        var templateName = pieces[0];
        var languageCode = pieces.Length >= 2 ? pieces[1] : "en_US";
        var parameterKeys = pieces.Length >= 3
            ? pieces[2].Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            : Array.Empty<string>();

        if (string.IsNullOrWhiteSpace(templateName)) return false;
        config = (templateName, languageCode, parameterKeys);
        return true;
    }

    private static object[] BuildTemplateParameters(string[] keys, Ecommerce.Domain.Common.StoreSettings settings, Order order, string decision)
    {
        if (keys.Length == 0) return Array.Empty<object>();

        return keys
            .Select(key => new { type = "text", text = ResolveTemplateValue(key, settings, order, decision) })
            .Cast<object>()
            .ToArray();
    }

    private static string ResolveTemplateValue(string key, Ecommerce.Domain.Common.StoreSettings settings, Order order, string decision)
    {
        return key.Trim().ToLowerInvariant() switch
        {
            "customername" => order.ShippingAddress.FullName,
            "ordernumber" => order.Number,
            "total" => order.Total.ToString("0.00", CultureInfo.InvariantCulture),
            "storename" => settings.CompanyBusinessName,
            "paymentstatus" => decision == "reject" ? "en revision" : "aprobado",
            "createdat" => order.CreatedAt.ToString("MMM dd, yyyy", CultureInfo.InvariantCulture),
            "date" => order.CreatedAt.ToString("MMM dd, yyyy", CultureInfo.InvariantCulture),
            _ => key
        };
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