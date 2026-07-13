using Asp.Versioning;
using Ecommerce.Application.Banners;
using Ecommerce.Application.Common;
using Ecommerce.Domain.Users;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ecommerce.Api.Controllers.V1;

[ApiController]
[ApiVersion(1)]
[Route("api/v{version:apiVersion}/banners")]
public sealed class BannersController(ISender sender) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<BannerDto>> List(CancellationToken cancellationToken) => sender.Send(new ListBannersQuery(true), cancellationToken);

    [Authorize(Policy = UserPermissionNames.BannersManage)]
    [HttpGet("admin")]
    public Task<IReadOnlyList<BannerDto>> ListAdmin(CancellationToken cancellationToken) => sender.Send(new ListBannersQuery(false), cancellationToken);

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<BannerDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var banner = await sender.Send(new GetBannerQuery(id), cancellationToken);
        return banner is null ? NotFound() : Ok(banner);
    }

    [Authorize(Policy = UserPermissionNames.BannersManage)]
    [HttpPost]
    public async Task<ActionResult<Guid>> Create(CreateBannerCommand command, CancellationToken cancellationToken)
    {
        var id = await sender.Send(command, cancellationToken);
        return CreatedAtAction(nameof(Get), new { id, version = "1" }, id);
    }

    [Authorize(Policy = UserPermissionNames.BannersManage)]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateBannerCommand command, CancellationToken cancellationToken)
    {
        if (id != command.Id) return BadRequest();
        return await sender.Send(command, cancellationToken) ? NoContent() : NotFound();
    }

    [Authorize(Policy = UserPermissionNames.BannersManage)]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken) =>
        await sender.Send(new DeleteBannerCommand(id), cancellationToken) ? NoContent() : NotFound();

    [Authorize(Policy = UserPermissionNames.BannersManage)]
    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> SetStatus(Guid id, SetBannerStatusCommand command, CancellationToken cancellationToken)
    {
        if (id != command.Id) return BadRequest();
        return await sender.Send(command, cancellationToken) ? NoContent() : NotFound();
    }
}