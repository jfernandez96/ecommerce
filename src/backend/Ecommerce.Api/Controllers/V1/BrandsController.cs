using Asp.Versioning;
using Ecommerce.Application.Brands;
using Ecommerce.Application.Common;
using Ecommerce.Domain.Users;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ecommerce.Api.Controllers.V1;

[ApiController]
[ApiVersion(1)]
[Route("api/v{version:apiVersion}/brands")]
public sealed class BrandsController(ISender sender) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<BrandDto>> List(CancellationToken cancellationToken) => sender.Send(new ListBrandsQuery(), cancellationToken);

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<BrandDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var brand = await sender.Send(new GetBrandQuery(id), cancellationToken);
        return brand is null ? NotFound() : Ok(brand);
    }

    [Authorize(Policy = UserPermissionNames.BrandsManage)]
    [HttpPost]
    public async Task<ActionResult<Guid>> Create(CreateBrandCommand command, CancellationToken cancellationToken)
    {
        var id = await sender.Send(command, cancellationToken);
        return CreatedAtAction(nameof(Get), new { id, version = "1" }, id);
    }

    [Authorize(Policy = UserPermissionNames.BrandsManage)]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateBrandCommand command, CancellationToken cancellationToken)
    {
        if (id != command.Id) return BadRequest();
        return await sender.Send(command, cancellationToken) ? NoContent() : NotFound();
    }

    [Authorize(Policy = UserPermissionNames.BrandsManage)]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken) =>
        await sender.Send(new DeleteBrandCommand(id), cancellationToken) ? NoContent() : NotFound();

    [Authorize(Policy = UserPermissionNames.BrandsManage)]
    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> SetStatus(Guid id, SetBrandStatusCommand command, CancellationToken cancellationToken)
    {
        if (id != command.Id) return BadRequest();
        return await sender.Send(command, cancellationToken) ? NoContent() : NotFound();
    }
}