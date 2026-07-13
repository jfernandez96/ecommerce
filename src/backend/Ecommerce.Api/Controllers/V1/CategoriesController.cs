using Asp.Versioning;
using Ecommerce.Application.Categories;
using Ecommerce.Application.Common;
using Ecommerce.Domain.Users;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ecommerce.Api.Controllers.V1;

[ApiController]
[ApiVersion(1)]
[Route("api/v{version:apiVersion}/categories")]
public sealed class CategoriesController(ISender sender) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<CategoryDto>> List(CancellationToken cancellationToken) => sender.Send(new ListCategoriesQuery(), cancellationToken);

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CategoryDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var category = await sender.Send(new GetCategoryQuery(id), cancellationToken);
        return category is null ? NotFound() : Ok(category);
    }

    [Authorize(Policy = UserPermissionNames.CategoriesManage)]
    [HttpPost]
    public async Task<ActionResult<Guid>> Create(CreateCategoryCommand command, CancellationToken cancellationToken)
    {
        var id = await sender.Send(command, cancellationToken);
        return CreatedAtAction(nameof(Get), new { id, version = "1" }, id);
    }

    [Authorize(Policy = UserPermissionNames.CategoriesManage)]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateCategoryCommand command, CancellationToken cancellationToken)
    {
        if (id != command.Id) return BadRequest();
        return await sender.Send(command, cancellationToken) ? NoContent() : NotFound();
    }

    [Authorize(Policy = UserPermissionNames.CategoriesManage)]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken) =>
        await sender.Send(new DeleteCategoryCommand(id), cancellationToken) ? NoContent() : NotFound();

    [Authorize(Policy = UserPermissionNames.CategoriesManage)]
    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> SetStatus(Guid id, SetCategoryStatusCommand command, CancellationToken cancellationToken)
    {
        if (id != command.Id) return BadRequest();
        return await sender.Send(command, cancellationToken) ? NoContent() : NotFound();
    }
}