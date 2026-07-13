using Asp.Versioning;
using Ecommerce.Application.Common;
using Ecommerce.Application.Users;
using Ecommerce.Domain.Users;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ecommerce.Api.Controllers.V1;

[ApiController]
[ApiVersion(1)]
[Route("api/v{version:apiVersion}/users")]
[Authorize]
public sealed class UsersController(ISender sender) : ControllerBase
{
    [Authorize(Policy = UserPermissionNames.UsersRead)]
    [HttpGet]
    public Task<PagedResult<AdminUserDto>> List([FromQuery] ListUsersQuery query, CancellationToken cancellationToken) =>
        sender.Send(query, cancellationToken);

    [Authorize(Policy = UserPermissionNames.UsersRead)]
    [HttpGet("audit")]
    public Task<PagedResult<AdminUserAuditLogDto>> ListAudit([FromQuery] ListUserAuditLogsQuery query, CancellationToken cancellationToken) =>
        sender.Send(query, cancellationToken);

    [Authorize(Policy = UserPermissionNames.UsersManage)]
    [HttpPost]
    public async Task<ActionResult<Guid>> Create(CreateUserCommand command, CancellationToken cancellationToken)
    {
        var id = await sender.Send(command, cancellationToken);
        return CreatedAtAction(nameof(List), new { version = "1" }, id);
    }

    [Authorize(Policy = UserPermissionNames.UsersManage)]
    [HttpPatch("{id:guid}/role")]
    public async Task<IActionResult> SetRole(Guid id, SetUserRoleCommand command, CancellationToken cancellationToken)
    {
        if (id != command.Id) return BadRequest();
        return await sender.Send(command, cancellationToken) ? NoContent() : NotFound();
    }

    [Authorize(Policy = UserPermissionNames.UsersManage)]
    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> UpdateProfile(Guid id, UpdateUserProfileCommand command, CancellationToken cancellationToken)
    {
        if (id != command.Id) return BadRequest();
        return await sender.Send(command, cancellationToken) ? NoContent() : NotFound();
    }

    [Authorize(Policy = UserPermissionNames.UsersManage)]
    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> SetStatus(Guid id, SetUserStatusCommand command, CancellationToken cancellationToken)
    {
        if (id != command.Id) return BadRequest();
        return await sender.Send(command, cancellationToken) ? NoContent() : NotFound();
    }

    [Authorize(Policy = UserPermissionNames.UsersManage)]
    [HttpPatch("{id:guid}/password")]
    public async Task<IActionResult> ResetPassword(Guid id, ResetUserPasswordCommand command, CancellationToken cancellationToken)
    {
        if (id != command.Id) return BadRequest();
        return await sender.Send(command, cancellationToken) ? NoContent() : NotFound();
    }
}
