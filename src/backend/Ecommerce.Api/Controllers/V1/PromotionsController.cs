using Asp.Versioning;
using Ecommerce.Application.Common;
using Ecommerce.Application.Promotions;
using Ecommerce.Domain.Users;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ecommerce.Api.Controllers.V1;

[ApiController]
[ApiVersion(1)]
[Route("api/v{version:apiVersion}/promotions")]
public sealed class PromotionsController(ISender sender) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<PromotionDto>> List(CancellationToken cancellationToken) => sender.Send(new ListPromotionsQuery(), cancellationToken);

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<PromotionDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var promotion = await sender.Send(new GetPromotionQuery(id), cancellationToken);
        return promotion is null ? NotFound() : Ok(promotion);
    }

    [Authorize(Policy = UserPermissionNames.PromotionsManage)]
    [HttpPost]
    public async Task<ActionResult<Guid>> Create(CreatePromotionCommand command, CancellationToken cancellationToken)
    {
        var id = await sender.Send(command, cancellationToken);
        return CreatedAtAction(nameof(Get), new { id, version = "1" }, id);
    }

    [Authorize(Policy = UserPermissionNames.PromotionsManage)]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdatePromotionCommand command, CancellationToken cancellationToken)
    {
        if (id != command.Id) return BadRequest();
        return await sender.Send(command, cancellationToken) ? NoContent() : NotFound();
    }

    [Authorize(Policy = UserPermissionNames.PromotionsManage)]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken) =>
        await sender.Send(new DeletePromotionCommand(id), cancellationToken) ? NoContent() : NotFound();

    [Authorize(Policy = UserPermissionNames.PromotionsManage)]
    [HttpPost("{id:guid}/duplicate")]
    public async Task<ActionResult<Guid>> Duplicate(Guid id, CancellationToken cancellationToken)
    {
        var copyId = await sender.Send(new DuplicatePromotionCommand(id), cancellationToken);
        return copyId is null ? NotFound() : Ok(copyId.Value);
    }

    [Authorize(Policy = UserPermissionNames.PromotionsManage)]
    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> SetStatus(Guid id, SetPromotionStatusCommand command, CancellationToken cancellationToken)
    {
        if (id != command.Id) return BadRequest();
        return await sender.Send(command, cancellationToken) ? NoContent() : NotFound();
    }
}