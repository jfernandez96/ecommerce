using Asp.Versioning;
using Ecommerce.Application.Products;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ecommerce.Api.Controllers.V1;

[ApiController]
[ApiVersion(1)]
[Authorize]
[Route("api/v{version:apiVersion}/uploads")]
public sealed class UploadsController(IProductImageStorageService imageStorageService) : ControllerBase
{
    private const int MaxAllowedBytes = 25 * 1024 * 1024;
    private static readonly HashSet<string> AllowedScopes = new(StringComparer.OrdinalIgnoreCase)
    {
        "products",
        "banners",
        "promotions",
        "categories",
        "brands"
    };

    [HttpPost("image")]
    [RequestSizeLimit(MaxAllowedBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxAllowedBytes)]
    public async Task<ActionResult<UploadImageResponse>> UploadImage([FromForm] UploadImageRequest request, CancellationToken cancellationToken)
    {
        if (request.File is null || request.File.Length == 0)
        {
            return BadRequest(new { detail = "Debes enviar una imagen valida." });
        }

        if (request.File.Length > MaxAllowedBytes)
        {
            return BadRequest(new { detail = "La imagen supera 25 MB." });
        }

        var scope = string.IsNullOrWhiteSpace(request.Scope) ? "products" : request.Scope.Trim();
        if (!AllowedScopes.Contains(scope))
        {
            return BadRequest(new { detail = "Scope de imagen no permitido." });
        }

        await using var stream = request.File.OpenReadStream();
        using var memoryStream = new MemoryStream();
        await stream.CopyToAsync(memoryStream, cancellationToken);

        var relativeUrl = await imageStorageService.SaveBinaryImageAsync(memoryStream.ToArray(), request.File.ContentType, scope, cancellationToken);
        return Ok(new UploadImageResponse(relativeUrl));
    }
}

public sealed record UploadImageRequest(IFormFile File, string? Scope);
public sealed record UploadImageResponse(string Url);
