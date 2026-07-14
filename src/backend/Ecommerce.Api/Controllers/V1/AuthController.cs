using Asp.Versioning;
using Ecommerce.Application.Auth;
using Ecommerce.Application.Common;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Ecommerce.Api.Controllers.V1;

[ApiController]
[ApiVersion(1)]
[Route("api/v{version:apiVersion}/auth")]
public sealed class AuthController(ISender sender, IJwtTokenService jwtTokenService) : ControllerBase
{
    private const string AccessTokenCookieName = "accessToken";
    private const string RefreshTokenCookieName = "refreshToken";

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<ActionResult<AuthSessionResponse>> Login(LoginCommand command, CancellationToken cancellationToken)
    {
        var token = await sender.Send(command, cancellationToken);
        if (token is null)
        {
            ClearAuthCookies();
            return Unauthorized();
        }

        SetAuthCookies(token);
        return Ok(new AuthSessionResponse(token.ExpiresAt));
    }

    [AllowAnonymous]
    [HttpPost("refresh")]
    public async Task<ActionResult<AuthSessionResponse>> Refresh(CancellationToken cancellationToken)
    {
        var refreshToken = Request.Cookies[RefreshTokenCookieName];
        if (string.IsNullOrWhiteSpace(refreshToken))
        {
            ClearAuthCookies();
            return Unauthorized();
        }

        TokenResponse? token;
        try
        {
            token = await sender.Send(new RefreshSessionCommand(refreshToken), cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            ClearAuthCookies();
            return Unauthorized();
        }

        if (token is null)
        {
            ClearAuthCookies();
            return Unauthorized();
        }

        SetAuthCookies(token);
        return Ok(new AuthSessionResponse(token.ExpiresAt));
    }

    [AllowAnonymous]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        var refreshToken = Request.Cookies[RefreshTokenCookieName];
        try
        {
            await sender.Send(new LogoutCommand(refreshToken), cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            // Session was already revoked by another request.
        }

        ClearAuthCookies();
        return NoContent();
    }

    [Authorize]
    [HttpPost("logout-all")]
    public async Task<IActionResult> LogoutAll(CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            ClearAuthCookies();
            return Unauthorized();
        }

        await sender.Send(new LogoutAllSessionsCommand(userId.Value), cancellationToken);
        ClearAuthCookies();
        return NoContent();
    }

    private void SetAuthCookies(TokenResponse token)
    {
        Response.Cookies.Append(AccessTokenCookieName, token.AccessToken, BuildCookieOptions(token.ExpiresAt));
        Response.Cookies.Append(RefreshTokenCookieName, token.RefreshToken, BuildCookieOptions(jwtTokenService.GetRefreshTokenExpiresAt()));
    }

    private void ClearAuthCookies()
    {
        Response.Cookies.Delete(AccessTokenCookieName, BuildCookieOptions(DateTimeOffset.UtcNow.AddDays(-1)));
        Response.Cookies.Delete(RefreshTokenCookieName, BuildCookieOptions(DateTimeOffset.UtcNow.AddDays(-1)));
    }

    private CookieOptions BuildCookieOptions(DateTimeOffset expiresAt) => new()
    {
        HttpOnly = true,
        Secure = true,
        SameSite = SameSiteMode.None,
        Path = "/",
        Expires = expiresAt,
        IsEssential = true,
    };

    private Guid? GetCurrentUserId()
    {
        var sub = User.FindFirstValue(JwtRegisteredClaimNames.Sub) ??
                  User.FindFirstValue(ClaimTypes.NameIdentifier);

        return Guid.TryParse(sub, out var userId) ? userId : null;
    }

    public sealed record AuthSessionResponse(DateTimeOffset ExpiresAt);
}