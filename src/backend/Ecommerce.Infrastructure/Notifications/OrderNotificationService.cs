using System.Net;
using System.Net.Mail;
using System.Text;
using Ecommerce.Application.Common;
using Ecommerce.Domain.Orders;
using Microsoft.Extensions.Logging;

namespace Ecommerce.Infrastructure.Notifications;

public sealed class OrderNotificationService(
    IStoreSettingsRepository settingsRepository,
    ILogger<OrderNotificationService> logger) : IOrderNotificationService
{
    public async Task SendSmtpTestEmailAsync(string recipientEmail, CancellationToken cancellationToken = default)
    {
        var settings = await settingsRepository.GetOrCreateAsync(cancellationToken);

        using var message = new MailMessage
        {
            From = new MailAddress(GetRequired(settings.SmtpFromEmail, "correo remitente SMTP"), settings.SmtpFromName ?? "Ecommerce"),
            Subject = "Prueba SMTP - Ecommerce",
            Body = "<div style=\"font-family:Segoe UI,Arial,sans-serif;color:#111827\"><h2>SMTP configurado correctamente</h2><p>Este es un correo de prueba enviado desde el panel de configuracion.</p></div>",
            IsBodyHtml = true,
        };

        message.To.Add(new MailAddress(recipientEmail));

        using var smtp = BuildSmtpClient(settings);
        await smtp.SendMailAsync(message, cancellationToken);
        logger.LogInformation("SMTP test email sent to {RecipientEmail}", recipientEmail);
    }

    public async Task SendOrderReceivedEmailAsync(Order order, string recipientEmail, CancellationToken cancellationToken = default)
    {
        var settings = await settingsRepository.GetOrCreateAsync(cancellationToken);

        using var message = new MailMessage
        {
            From = new MailAddress(GetRequired(settings.SmtpFromEmail, "correo remitente SMTP"), settings.SmtpFromName ?? "Ecommerce"),
            Subject = $"Nuevo pedido {order.Number}",
            Body = BuildHtmlBody(order),
            IsBodyHtml = true,
        };

        message.To.Add(new MailAddress(recipientEmail));

        using var smtp = BuildSmtpClient(settings);

        await smtp.SendMailAsync(message, cancellationToken);
        logger.LogInformation("Order notification email sent for order {OrderNumber} to {RecipientEmail}", order.Number, recipientEmail);
    }

    private static SmtpClient BuildSmtpClient(Ecommerce.Domain.Common.StoreSettings settings)
    {
        var smtp = new SmtpClient(GetRequired(settings.SmtpHost, "host SMTP"), settings.SmtpPort)
        {
            EnableSsl = settings.SmtpUseSsl,
            DeliveryMethod = SmtpDeliveryMethod.Network,
            UseDefaultCredentials = false,
        };

        if (!string.IsNullOrWhiteSpace(settings.SmtpUser) && !string.IsNullOrWhiteSpace(settings.SmtpPassword))
        {
            smtp.Credentials = new NetworkCredential(settings.SmtpUser, settings.SmtpPassword);
        }

        return smtp;
    }

    private static string GetRequired(string? value, string fieldName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new InvalidOperationException($"Configura {fieldName} antes de enviar correos.");
        }

        return value;
    }

    private static string BuildHtmlBody(Order order)
    {
        var sb = new StringBuilder();
        sb.Append("<div style=\"font-family:Segoe UI,Arial,sans-serif;color:#111827;line-height:1.5\">");
        sb.Append("<h2 style=\"margin:0 0 8px\">Nuevo pedido recibido</h2>");
        sb.Append($"<p style=\"margin:0 0 16px\"><strong>Nro pedido:</strong> {WebUtility.HtmlEncode(order.Number)}</p>");
        sb.Append("<h3 style=\"margin:16px 0 8px\">Cliente</h3>");
        sb.Append($"<p style=\"margin:0\"><strong>Email:</strong> {WebUtility.HtmlEncode(order.CustomerEmail)}</p>");
        sb.Append($"<p style=\"margin:0\"><strong>Nombre:</strong> {WebUtility.HtmlEncode(order.ShippingAddress.FullName)}</p>");
        sb.Append($"<p style=\"margin:0\"><strong>Telefono:</strong> {WebUtility.HtmlEncode(order.ShippingAddress.Phone)}</p>");
        sb.Append($"<p style=\"margin:0\"><strong>Documento:</strong> {WebUtility.HtmlEncode(order.DocumentNumber)}</p>");

        sb.Append("<h3 style=\"margin:16px 0 8px\">Direccion de entrega</h3>");
        sb.Append($"<p style=\"margin:0\">{WebUtility.HtmlEncode(order.ShippingAddress.Line1)}</p>");
        sb.Append($"<p style=\"margin:0\">{WebUtility.HtmlEncode(order.ShippingAddress.District)}, {WebUtility.HtmlEncode(order.ShippingAddress.Province)}, {WebUtility.HtmlEncode(order.ShippingAddress.Department)}</p>");
        if (!string.IsNullOrWhiteSpace(order.ShippingAddress.Reference))
        {
            sb.Append($"<p style=\"margin:0\"><strong>Referencia:</strong> {WebUtility.HtmlEncode(order.ShippingAddress.Reference)}</p>");
        }

        sb.Append("<h3 style=\"margin:16px 0 8px\">Items</h3>");
        sb.Append("<table style=\"width:100%;border-collapse:collapse;font-size:14px\"><thead><tr>");
        sb.Append("<th style=\"text-align:left;border-bottom:1px solid #e5e7eb;padding:6px 4px\">Producto</th>");
        sb.Append("<th style=\"text-align:center;border-bottom:1px solid #e5e7eb;padding:6px 4px\">Cant.</th>");
        sb.Append("<th style=\"text-align:right;border-bottom:1px solid #e5e7eb;padding:6px 4px\">PU</th>");
        sb.Append("<th style=\"text-align:right;border-bottom:1px solid #e5e7eb;padding:6px 4px\">Total</th>");
        sb.Append("</tr></thead><tbody>");

        foreach (var item in order.Items)
        {
            var variant = string.IsNullOrWhiteSpace(item.Color) && string.IsNullOrWhiteSpace(item.Size)
                ? string.Empty
                : $" ({item.Color} {item.Size})";

            sb.Append("<tr>");
            sb.Append($"<td style=\"padding:8px 4px;border-bottom:1px solid #f3f4f6\">{WebUtility.HtmlEncode(item.ProductName + variant)}</td>");
            sb.Append($"<td style=\"padding:8px 4px;text-align:center;border-bottom:1px solid #f3f4f6\">{item.Quantity}</td>");
            sb.Append($"<td style=\"padding:8px 4px;text-align:right;border-bottom:1px solid #f3f4f6\">S/ {item.UnitPrice:0.00}</td>");
            sb.Append($"<td style=\"padding:8px 4px;text-align:right;border-bottom:1px solid #f3f4f6\">S/ {item.Total:0.00}</td>");
            sb.Append("</tr>");
        }

        sb.Append("</tbody></table>");

        sb.Append("<h3 style=\"margin:16px 0 8px\">Resumen</h3>");
        sb.Append($"<p style=\"margin:0\"><strong>Subtotal:</strong> S/ {order.Subtotal:0.00}</p>");
        sb.Append($"<p style=\"margin:0\"><strong>Envio:</strong> S/ {order.Shipping:0.00}</p>");
        sb.Append($"<p style=\"margin:0\"><strong>Total:</strong> S/ {order.Total:0.00}</p>");

        if (!string.IsNullOrWhiteSpace(order.Notes))
        {
            sb.Append($"<p style=\"margin:12px 0 0\"><strong>Notas:</strong> {WebUtility.HtmlEncode(order.Notes)}</p>");
        }

        sb.Append("</div>");
        return sb.ToString();
    }
}
