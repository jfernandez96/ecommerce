using Ecommerce.Application.Common;
using Ecommerce.Application.Users;
using Ecommerce.Domain.Users;
using MediatR;

namespace Ecommerce.Application.Auth;

public sealed record LoginCommand(string Email, string Password) : IRequest<TokenResponse?>;
public sealed record RefreshSessionCommand(string RefreshToken) : IRequest<TokenResponse?>;
public sealed record LogoutCommand(string? RefreshToken) : IRequest<Unit>;
public sealed record LogoutAllSessionsCommand(Guid UserId) : IRequest<Unit>;

public interface IUserRepository
{
    Task<AppUser?> GetByEmailAsync(string email, CancellationToken cancellationToken = default);
    Task<AppUser?> GetByRefreshTokenHashAsync(string tokenHash, CancellationToken cancellationToken = default);
    Task<AppUser?> GetByIdWithRefreshTokensAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<AppUser?> GetByIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<PagedResult<AppUser>> SearchAsync(UserListRequest request, CancellationToken cancellationToken = default);
    Task<bool> ExistsByEmailAsync(string email, CancellationToken cancellationToken = default);
    Task AddAsync(AppUser user, CancellationToken cancellationToken = default);
    Task AddRefreshTokenAsync(RefreshToken refreshToken, CancellationToken cancellationToken = default);
    Task AddUserAuditLogAsync(UserAuditLog log, CancellationToken cancellationToken = default);
    Task<PagedResult<UserAuditLog>> SearchUserAuditLogsAsync(UserAuditListRequest request, CancellationToken cancellationToken = default);
}

public sealed class LoginCommandHandler(IUserRepository users, IPasswordHasher passwordHasher, IJwtTokenService jwtTokenService, IUnitOfWork unitOfWork)
    : IRequestHandler<LoginCommand, TokenResponse?>
{
    private const int MaxActiveSessions = 5;
    private static readonly TimeSpan RevokedTokenRetention = TimeSpan.FromDays(30);

    private static void CleanupAndLimitSessions(AppUser user)
    {
        var now = DateTimeOffset.UtcNow;

        user.RefreshTokens.RemoveAll(token =>
            token.ExpiresAt <= now ||
            (token.RevokedAt.HasValue && token.RevokedAt.Value <= now.Subtract(RevokedTokenRetention)));

        var activeTokens = user.RefreshTokens
            .Where(token => token.IsActive)
            .OrderByDescending(token => token.CreatedAt)
            .ToList();

        if (activeTokens.Count < MaxActiveSessions)
        {
            return;
        }

        foreach (var token in activeTokens.Skip(MaxActiveSessions - 1))
        {
            token.RevokedAt ??= now;
        }
    }

    public async Task<TokenResponse?> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var user = await users.GetByEmailAsync(request.Email.Trim().ToLowerInvariant(), cancellationToken);
        if (user is null || !user.IsActive || !passwordHasher.Verify(request.Password, user.PasswordHash))
        {
            return null;
        }

        CleanupAndLimitSessions(user);

        var token = jwtTokenService.CreateToken(user.Id, user.Email, user.FullName, user.Role.ToString());
        await users.AddRefreshTokenAsync(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = jwtTokenService.HashRefreshToken(token.RefreshToken),
            ExpiresAt = jwtTokenService.GetRefreshTokenExpiresAt(),
        }, cancellationToken);
        try
        {
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }
        catch (Exception exception) when (exception.GetType().Name == "DbUpdateConcurrencyException")
        {
            var freshUser = await users.GetByIdWithRefreshTokensAsync(user.Id, cancellationToken);
            if (freshUser is null)
            {
                return null;
            }

            var retryToken = jwtTokenService.CreateToken(freshUser.Id, freshUser.Email, freshUser.FullName, freshUser.Role.ToString());
            await users.AddRefreshTokenAsync(new RefreshToken
            {
                UserId = freshUser.Id,
                TokenHash = jwtTokenService.HashRefreshToken(retryToken.RefreshToken),
                ExpiresAt = jwtTokenService.GetRefreshTokenExpiresAt(),
            }, cancellationToken);

            await unitOfWork.SaveChangesAsync(cancellationToken);
            return retryToken;
        }

        return token;
    }
}

public sealed class RefreshSessionCommandHandler(IUserRepository users, IJwtTokenService jwtTokenService, IUnitOfWork unitOfWork)
    : IRequestHandler<RefreshSessionCommand, TokenResponse?>
{
    private static readonly TimeSpan RevokedTokenRetention = TimeSpan.FromDays(30);

    private static void CleanupExpiredAndOldRevokedTokens(AppUser user)
    {
        var now = DateTimeOffset.UtcNow;
        user.RefreshTokens.RemoveAll(token =>
            token.ExpiresAt <= now ||
            (token.RevokedAt.HasValue && token.RevokedAt.Value <= now.Subtract(RevokedTokenRetention)));
    }

    public async Task<TokenResponse?> Handle(RefreshSessionCommand request, CancellationToken cancellationToken)
    {
        var tokenHash = jwtTokenService.HashRefreshToken(request.RefreshToken.Trim());
        var user = await users.GetByRefreshTokenHashAsync(tokenHash, cancellationToken);
        var currentToken = user?.RefreshTokens.FirstOrDefault(token => token.TokenHash == tokenHash);
        if (user is null || currentToken is null || !currentToken.IsActive || !user.IsActive)
        {
            return null;
        }

        var newToken = jwtTokenService.CreateToken(user.Id, user.Email, user.FullName, user.Role.ToString());
        var newTokenHash = jwtTokenService.HashRefreshToken(newToken.RefreshToken);

        CleanupExpiredAndOldRevokedTokens(user);

        currentToken.RevokedAt = DateTimeOffset.UtcNow;
        currentToken.ReplacedByTokenHash = newTokenHash;
        await users.AddRefreshTokenAsync(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = newTokenHash,
            ExpiresAt = jwtTokenService.GetRefreshTokenExpiresAt(),
        }, cancellationToken);

        try
        {
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }
        catch (Exception exception) when (exception.GetType().Name == "DbUpdateConcurrencyException")
        {
            return null;
        }

        return newToken;
    }
}

public sealed class LogoutCommandHandler(IUserRepository users, IJwtTokenService jwtTokenService, IUnitOfWork unitOfWork)
    : IRequestHandler<LogoutCommand, Unit>
{
    public async Task<Unit> Handle(LogoutCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            return Unit.Value;
        }

        var tokenHash = jwtTokenService.HashRefreshToken(request.RefreshToken.Trim());
        var user = await users.GetByRefreshTokenHashAsync(tokenHash, cancellationToken);
        var refreshToken = user?.RefreshTokens.FirstOrDefault(token => token.TokenHash == tokenHash);
        if (refreshToken is null)
        {
            return Unit.Value;
        }

        refreshToken.RevokedAt ??= DateTimeOffset.UtcNow;
        try
        {
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }
        catch (Exception exception) when (exception.GetType().Name == "DbUpdateConcurrencyException")
        {
            // Token was already revoked by another request.
        }

        return Unit.Value;
    }
}

public sealed class LogoutAllSessionsCommandHandler(IUserRepository users, IUnitOfWork unitOfWork)
    : IRequestHandler<LogoutAllSessionsCommand, Unit>
{
    public async Task<Unit> Handle(LogoutAllSessionsCommand request, CancellationToken cancellationToken)
    {
        if (request.UserId == Guid.Empty)
        {
            return Unit.Value;
        }

        var user = await users.GetByIdWithRefreshTokensAsync(request.UserId, cancellationToken);
        if (user is null)
        {
            return Unit.Value;
        }

        var now = DateTimeOffset.UtcNow;
        foreach (var token in user.RefreshTokens.Where(token => token.IsActive))
        {
            token.RevokedAt = now;
        }

        try
        {
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }
        catch (Exception exception) when (exception.GetType().Name == "DbUpdateConcurrencyException")
        {
            // Session state changed concurrently; consider operation effectively completed.
        }

        return Unit.Value;
    }
}