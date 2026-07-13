using Asp.Versioning;
using Ecommerce.Application.Settings;
using Ecommerce.Domain.Users;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ecommerce.Api.Controllers.V1;

[ApiController]
[ApiVersion(1)]
[Route("api/v{version:apiVersion}/settings")]
[Authorize(Policy = UserPermissionNames.SettingsManage)]
public sealed class SettingsController(ISender sender) : ControllerBase
{
    // Admin: full settings
    [HttpGet]
    public Task<StoreSettingsDto> Get(CancellationToken cancellationToken) =>
        sender.Send(new GetStoreSettingsQuery(), cancellationToken);

    // Public: only the information the storefront needs (payment methods available + shipping costs)
    [AllowAnonymous]
    [HttpGet("public")]
    public async Task<ActionResult<PublicStoreSettingsDto>> GetPublic(CancellationToken cancellationToken)
    {
        var dto = await sender.Send(new GetStoreSettingsQuery(), cancellationToken);
        return Ok(new PublicStoreSettingsDto(
            dto.Payment.PaymentGatewayEnabled,
            dto.Shipping.FreeShippingLima,
            dto.Shipping.ProvinceShippingCost));
    }

    [AllowAnonymous]
    [HttpGet("public-footer")]
    public async Task<ActionResult<PublicFooterSettingsDto>> GetPublicFooter(CancellationToken cancellationToken)
    {
        var dto = await sender.Send(new GetStoreSettingsQuery(), cancellationToken);
        return Ok(new PublicFooterSettingsDto(
            dto.Company.CompanyRuc,
            dto.Company.CompanyBusinessName,
            dto.Company.StoreName,
            dto.Company.CompanyAddress,
            dto.Company.CompanyPhone,
            dto.Company.CompanyEmail));
    }

    [HttpPut("company")]
    public Task<StoreSettingsDto> UpdateCompany(UpdateCompanySettingsCommand command, CancellationToken cancellationToken) =>
        sender.Send(command, cancellationToken);

    [HttpPut("shipping")]
    public Task<StoreSettingsDto> UpdateShipping(UpdateShippingSettingsCommand command, CancellationToken cancellationToken) =>
        sender.Send(command, cancellationToken);

    [HttpPut("tax")]
    public Task<StoreSettingsDto> UpdateTax(UpdateTaxSettingsCommand command, CancellationToken cancellationToken) =>
        sender.Send(command, cancellationToken);

    [HttpPut("payment")]
    public Task<StoreSettingsDto> UpdatePayment(UpdatePaymentSettingsCommand command, CancellationToken cancellationToken) =>
        sender.Send(command, cancellationToken);

    [HttpPut("sunat")]
    public Task<StoreSettingsDto> UpdateSunat(UpdateSunatSettingsCommand command, CancellationToken cancellationToken) =>
        sender.Send(command, cancellationToken);

    [HttpPut("whatsapp")]
    public Task<StoreSettingsDto> UpdateWhatsApp(UpdateWhatsAppSettingsCommand command, CancellationToken cancellationToken) =>
        sender.Send(command, cancellationToken);

    [HttpPost("payment/test-email")]
    public async Task<IActionResult> SendTestEmail(SendTestEmailCommand command, CancellationToken cancellationToken)
    {
        await sender.Send(command, cancellationToken);
        return Ok(new { message = "Correo de prueba enviado correctamente." });
    }

    [HttpPost("whatsapp/test")]
    public async Task<IActionResult> SendTestWhatsApp(SendTestWhatsAppCommand command, CancellationToken cancellationToken)
    {
        await sender.Send(command, cancellationToken);
        return Ok(new { message = "Mensaje de prueba enviado correctamente a WhatsApp." });
    }
}
