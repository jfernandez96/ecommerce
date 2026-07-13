using Asp.Versioning;
using Ecommerce.Application.Common;
using Ecommerce.Application.Sales;
using Ecommerce.Domain.Users;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ecommerce.Api.Controllers.V1;

[ApiController]
[ApiVersion(1)]
[Route("api/v{version:apiVersion}/sales")]
public sealed class SalesController(ISender sender) : ControllerBase
{
    [Authorize(Policy = UserPermissionNames.SalesRead)]
    [HttpGet("admin")]
    public Task<SaleAdminSearchResultDto> SearchAdmin([FromQuery] SaleAdminSearchRequest request, CancellationToken cancellationToken) =>
        sender.Send(new SearchAdminSalesQuery(request), cancellationToken);

    [Authorize(Policy = UserPermissionNames.SalesExport)]
    [HttpGet("admin/export/excel")]
    public async Task<IActionResult> ExportExcel([FromQuery] SaleAdminSearchRequest request, CancellationToken cancellationToken)
    {
        var file = await sender.Send(new ExportAdminSalesExcelQuery(request), cancellationToken);
        return File(file.Content, file.ContentType, file.FileName);
    }

    [Authorize(Policy = UserPermissionNames.SalesExport)]
    [HttpGet("admin/export/pdf")]
    public async Task<IActionResult> ExportPdf([FromQuery] SaleAdminSearchRequest request, CancellationToken cancellationToken)
    {
        var file = await sender.Send(new ExportAdminSalesPdfQuery(request), cancellationToken);
        return File(file.Content, file.ContentType, file.FileName);
    }

    [Authorize(Policy = UserPermissionNames.SalesSunat)]
    [HttpPost("admin/{orderId:guid}/sunat/send")]
    public Task<SendSaleToSunatResultDto> SendToSunat(Guid orderId, CancellationToken cancellationToken) =>
        sender.Send(new SendSaleToSunatCommand(orderId), cancellationToken);

    [Authorize(Policy = UserPermissionNames.SalesExport)]
    [HttpGet("admin/{orderId:guid}/sunat/xml")]
    public async Task<IActionResult> DownloadSunatXml(Guid orderId, CancellationToken cancellationToken)
    {
        var file = await sender.Send(new DownloadSaleSunatXmlQuery(orderId), cancellationToken);
        return File(file.Content, file.ContentType, file.FileName);
    }

    [Authorize(Policy = UserPermissionNames.SalesExport)]
    [HttpGet("admin/{orderId:guid}/sunat/cdr")]
    public async Task<IActionResult> DownloadSunatCdr(Guid orderId, CancellationToken cancellationToken)
    {
        var file = await sender.Send(new DownloadSaleSunatCdrQuery(orderId), cancellationToken);
        return File(file.Content, file.ContentType, file.FileName);
    }
}