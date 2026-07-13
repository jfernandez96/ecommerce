using Asp.Versioning;
using Ecommerce.Application.Common;
using Ecommerce.Application.Products;
using Ecommerce.Domain.Users;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ecommerce.Api.Controllers.V1;

[ApiController]
[ApiVersion(1)]
[Route("api/v{version:apiVersion}/products")]
public sealed class ProductsController(ISender sender) : ControllerBase
{
    [HttpGet]
    public Task<PagedResult<ProductSummaryDto>> Search([FromQuery] ProductSearchRequest request, CancellationToken cancellationToken) =>
        sender.Send(new SearchProductsQuery(request), cancellationToken);

    [HttpGet("{slug}")]
    public async Task<ActionResult<ProductDetailDto>> GetBySlug(string slug, CancellationToken cancellationToken)
    {
        var product = await sender.Send(new GetProductBySlugQuery(slug), cancellationToken);
        return product is null ? NotFound() : Ok(product);
    }

    [Authorize(Policy = UserPermissionNames.ProductsManage)]
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProductAdminDto>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var product = await sender.Send(new GetProductAdminQuery(id), cancellationToken);
        return product is null ? NotFound() : Ok(product);
    }

    [Authorize(Policy = UserPermissionNames.ProductsManage)]
    [HttpPost]
    public async Task<ActionResult<Guid>> Create(CreateProductCommand command, CancellationToken cancellationToken)
    {
        var id = await sender.Send(command, cancellationToken);
        return CreatedAtAction(nameof(GetBySlug), new { slug = command.Slug, version = "1" }, id);
    }

    [Authorize(Policy = UserPermissionNames.ProductsManage)]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateProductCommand command, CancellationToken cancellationToken)
    {
        if (id != command.Id) return BadRequest();
        return await sender.Send(command, cancellationToken) ? NoContent() : NotFound();
    }

    [Authorize(Policy = UserPermissionNames.ProductsManage)]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken) =>
        await sender.Send(new DeleteProductCommand(id), cancellationToken) ? NoContent() : NotFound();

    [Authorize(Policy = UserPermissionNames.ProductsManage)]
    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> SetStatus(Guid id, SetProductStatusCommand command, CancellationToken cancellationToken)
    {
        if (id != command.Id) return BadRequest();
        return await sender.Send(command, cancellationToken) ? NoContent() : NotFound();
    }
}