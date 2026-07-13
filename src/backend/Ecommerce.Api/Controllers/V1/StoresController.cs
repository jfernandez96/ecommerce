using Asp.Versioning;
using Ecommerce.Application.Common;
using Ecommerce.Application.Stores;
using Ecommerce.Domain.Users;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ecommerce.Api.Controllers.V1;

[ApiController]
[ApiVersion(1)]
[Route("api/v{version:apiVersion}/stores")]
public sealed class StoresController(ISender sender) : ControllerBase
{
    [AllowAnonymous]
    [HttpGet("public")]
    public Task<IReadOnlyList<StoreLocationDto>> ListPublic(CancellationToken cancellationToken) =>
        sender.Send(new ListStoresQuery(true), cancellationToken);

    [Authorize(Policy = UserPermissionNames.StoresRead)]
    [HttpGet]
    public Task<IReadOnlyList<StoreLocationDto>> List([FromQuery] bool activeOnly = false, CancellationToken cancellationToken = default) =>
        sender.Send(new ListStoresQuery(activeOnly), cancellationToken);

    [Authorize(Policy = UserPermissionNames.StoresManage)]
    [HttpPost]
    public async Task<ActionResult<Guid>> Create(CreateStoreCommand command, CancellationToken cancellationToken)
    {
        var id = await sender.Send(command, cancellationToken);
        return CreatedAtAction(nameof(List), new { version = "1" }, id);
    }

    [Authorize(Policy = UserPermissionNames.StoresManage)]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateStoreCommand command, CancellationToken cancellationToken)
    {
        if (id != command.Id) return BadRequest();
        return await sender.Send(command, cancellationToken) ? NoContent() : NotFound();
    }
}
