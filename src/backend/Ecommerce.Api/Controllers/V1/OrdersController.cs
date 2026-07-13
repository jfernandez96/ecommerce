using Asp.Versioning;
using Ecommerce.Application.Common;
using Ecommerce.Application.Orders;
using Ecommerce.Domain.Users;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ecommerce.Api.Controllers.V1;

[ApiController]
[ApiVersion(1)]
[Route("api/v{version:apiVersion}/orders")]
public sealed class OrdersController(ISender sender) : ControllerBase
{
    [HttpPost("checkout")]
    public Task<OrderCheckoutResultDto> Checkout(CreateOrderCommand command, CancellationToken cancellationToken) =>
        sender.Send(command, cancellationToken);

    [Authorize(Policy = UserPermissionNames.OrdersRead)]
    [HttpGet("admin")]
    public Task<OrderAdminSearchResultDto> SearchAdmin([FromQuery] OrderAdminSearchRequest request, CancellationToken cancellationToken) =>
        sender.Send(new SearchAdminOrdersQuery(request), cancellationToken);

    [Authorize(Policy = UserPermissionNames.OrdersRead)]
    [HttpGet("admin/{id:guid}")]
    public async Task<ActionResult<OrderAdminDetailDto>> GetAdminDetail(Guid id, CancellationToken cancellationToken)
    {
        var order = await sender.Send(new GetOrderAdminDetailQuery(id), cancellationToken);
        return order is null ? NotFound() : Ok(order);
    }

    [Authorize(Policy = UserPermissionNames.OrdersUpdate)]
    [HttpPatch("admin/{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id, CancelOrderCommand command, CancellationToken cancellationToken)
    {
        if (id != command.Id) return BadRequest();
        return await sender.Send(command, cancellationToken) ? NoContent() : NotFound();
    }

    [Authorize(Policy = UserPermissionNames.OrdersUpdate)]
    [HttpPatch("admin/{id:guid}/reactivate")]
    public async Task<IActionResult> Reactivate(Guid id, ReactivateOrderCommand command, CancellationToken cancellationToken)
    {
        if (id != command.Id) return BadRequest();
        return await sender.Send(command, cancellationToken) ? NoContent() : NotFound();
    }

    [Authorize(Policy = UserPermissionNames.OrdersUpdate)]
    [HttpPatch("admin/{id:guid}/payment-status")]
    public async Task<IActionResult> UpdatePaymentStatus(Guid id, UpdateOrderPaymentStatusCommand command, CancellationToken cancellationToken)
    {
        if (id != command.Id) return BadRequest();
        return await sender.Send(command, cancellationToken) ? NoContent() : NotFound();
    }

    [Authorize(Policy = UserPermissionNames.OrdersUpdate)]
    [HttpPost("admin/{id:guid}/whatsapp")]
    public async Task<IActionResult> SendWhatsApp(Guid id, SendOrderWhatsAppCommand command, CancellationToken cancellationToken)
    {
        if (id != command.Id) return BadRequest();
        await sender.Send(command, cancellationToken);
        return Ok(new { message = "Mensaje de WhatsApp enviado correctamente." });
    }
}