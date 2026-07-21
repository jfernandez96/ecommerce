using Asp.Versioning;
using Ecommerce.Application.Common;
using Ecommerce.Application.Integrations;
using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ecommerce.Api.Controllers.V1;

[ApiController]
[ApiVersion(1)]
[AllowAnonymous]
[Route("api/v{version:apiVersion}/integrations/whatsapp")]
public sealed class IntegrationsController(
    ISender sender,
    IIntegrationClientSecurityService integrationSecurity,
    IIntegrationAuditService integrationAudit) : ControllerBase
{
    [HttpPost("send")]
    public async Task<IActionResult> SendExternalWhatsApp([FromBody] SendExternalWhatsAppRequest request, CancellationToken cancellationToken)
    {
        var clientId = Request.Headers["X-Integration-Client"].FirstOrDefault()?.Trim();
        var apiKey = Request.Headers["X-Api-Key"].FirstOrDefault()?.Trim();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        var userAgent = Request.Headers.UserAgent.ToString();

        var access = await integrationSecurity.AuthorizeAsync(clientId, apiKey, "whatsapp.send", cancellationToken);
        if (!access.IsAllowed)
        {
            if (access.RetryAfterSeconds.HasValue)
            {
                Response.Headers.RetryAfter = access.RetryAfterSeconds.Value.ToString();
            }

            await integrationAudit.WriteAsync(new IntegrationAuditEntry(
                Timestamp: DateTimeOffset.UtcNow,
                Channel: "whatsapp",
                Scope: "whatsapp.send",
                ClientId: access.ClientId ?? clientId,
                SourceSystem: request.SourceSystem,
                ExternalId: request.ExternalId,
                ToPhone: request.ToPhone,
                Status: "denied",
                Detail: access.ErrorCode,
                IpAddress: ipAddress,
                UserAgent: userAgent), cancellationToken);

            if (access.ErrorCode == "rate_limited")
            {
                return StatusCode(StatusCodes.Status429TooManyRequests, new { code = access.ErrorCode, detail = access.Message });
            }

            return Unauthorized(new { code = access.ErrorCode, detail = access.Message });
        }

        try
        {
            var result = await sender.Send(new SendIntegrationWhatsAppMessageCommand(
                access.ClientId!,
                request.ToPhone.Trim(),
                request.Message.Trim(),
                request.ExternalId?.Trim(),
                request.SourceSystem?.Trim()), cancellationToken);

            await integrationAudit.WriteAsync(new IntegrationAuditEntry(
                Timestamp: DateTimeOffset.UtcNow,
                Channel: "whatsapp",
                Scope: "whatsapp.send",
                ClientId: access.ClientId,
                SourceSystem: request.SourceSystem,
                ExternalId: request.ExternalId,
                ToPhone: request.ToPhone,
                Status: "success",
                Detail: "sent",
                IpAddress: ipAddress,
                UserAgent: userAgent), cancellationToken);

            return Ok(result);
        }
        catch (Exception ex)
        {
            await integrationAudit.WriteAsync(new IntegrationAuditEntry(
                Timestamp: DateTimeOffset.UtcNow,
                Channel: "whatsapp",
                Scope: "whatsapp.send",
                ClientId: access.ClientId,
                SourceSystem: request.SourceSystem,
                ExternalId: request.ExternalId,
                ToPhone: request.ToPhone,
                Status: "error",
                Detail: ex.Message,
                IpAddress: ipAddress,
                UserAgent: userAgent), cancellationToken);

            return StatusCode(StatusCodes.Status502BadGateway, new { code = "provider_error", detail = "No se pudo enviar el mensaje de WhatsApp." });
        }
    }
}

public sealed record SendExternalWhatsAppRequest(
    string ToPhone,
    string Message,
    string? ExternalId,
    string? SourceSystem);

public sealed class SendExternalWhatsAppRequestValidator : AbstractValidator<SendExternalWhatsAppRequest>
{
    public SendExternalWhatsAppRequestValidator()
    {
        RuleFor(x => x.ToPhone).NotEmpty().MaximumLength(30);
        RuleFor(x => x.Message).NotEmpty().MaximumLength(1200);
        RuleFor(x => x.ExternalId).MaximumLength(120);
        RuleFor(x => x.SourceSystem).MaximumLength(120);
    }
}
