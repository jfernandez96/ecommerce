using Asp.Versioning;
using Ecommerce.Application.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ecommerce.Api.Controllers.V1;

[ApiController]
[ApiVersion(1)]
[Route("api/v{version:apiVersion}/claim-book")]
[AllowAnonymous]
public sealed class ClaimBookController(ISender sender) : ControllerBase
{
    [HttpPost]
    public Task<RegisterClaimBookEntryResultDto> Register(RegisterClaimBookEntryCommand command, CancellationToken cancellationToken) =>
        sender.Send(command, cancellationToken);
}
