using Asp.Versioning;
using Ecommerce.Application.Customers;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace Ecommerce.Api.Controllers.V1;

[ApiController]
[ApiVersion(1)]
[Route("api/v{version:apiVersion}/wishlist")]
public sealed class WishlistController(ISender sender) : ControllerBase
{
    [HttpGet]
    public Task<WishlistDto> GetByEmail([FromQuery] string email, CancellationToken cancellationToken) =>
        sender.Send(new GetWishlistQuery(email), cancellationToken);

    [HttpPost("add")]
    public Task<AddToWishlistResultDto> AddToWishlist(AddToWishlistCommand command, CancellationToken cancellationToken) =>
        sender.Send(command, cancellationToken);

    [HttpPost("remove")]
    public Task<RemoveFromWishlistResultDto> RemoveFromWishlist(RemoveFromWishlistCommand command, CancellationToken cancellationToken) =>
        sender.Send(command, cancellationToken);
}
