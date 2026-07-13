using Asp.Versioning;
using Ecommerce.Application.Common;
using Ecommerce.Application.Inventory;
using Ecommerce.Domain.Users;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ecommerce.Api.Controllers.V1;

[ApiController]
[ApiVersion(1)]
[Route("api/v{version:apiVersion}/inventory")]
[Authorize]
public sealed class InventoryController(ISender sender) : ControllerBase
{
    [Authorize(Policy = UserPermissionNames.InventoryRead)]
    [HttpGet("admin/movements")]
    public Task<PagedResult<InventoryMovementDto>> SearchMovements([FromQuery] InventoryMovementSearchRequest request, CancellationToken cancellationToken) =>
        sender.Send(new SearchInventoryMovementsQuery(request), cancellationToken);

    [Authorize(Policy = UserPermissionNames.InventoryRead)]
    [HttpGet("admin/low-stock")]
    public Task<IReadOnlyList<LowStockAlertDto>> GetLowStockAlerts([FromQuery] int top = 30, CancellationToken cancellationToken = default) =>
        sender.Send(new GetLowStockAlertsQuery(top), cancellationToken);

    [Authorize(Policy = UserPermissionNames.InventoryWrite)]
    [HttpPost("admin/stock-in")]
    public Task<InventoryMovementDto> RegisterStockIn(RegisterStockInCommand command, CancellationToken cancellationToken) =>
        sender.Send(command, cancellationToken);

    [Authorize(Policy = UserPermissionNames.InventoryWrite)]
    [HttpPost("admin/stock-out")]
    public Task<InventoryMovementDto> RegisterStockOut(RegisterStockOutCommand command, CancellationToken cancellationToken) =>
        sender.Send(command, cancellationToken);
}
