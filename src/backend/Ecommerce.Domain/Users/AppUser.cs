using Ecommerce.Domain.Common;

namespace Ecommerce.Domain.Users;

public sealed class AppUser : AuditableEntity
{
    public required string Email { get; set; }
    public required string PasswordHash { get; set; }
    public required string FullName { get; set; }
    public UserRole Role { get; set; } = UserRole.Customer;
    public bool IsActive { get; set; } = true;
    public List<RefreshToken> RefreshTokens { get; set; } = [];
}

public sealed class RefreshToken : AuditableEntity
{
    public Guid UserId { get; set; }
    public AppUser? User { get; set; }
    public required string TokenHash { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public string? ReplacedByTokenHash { get; set; }
    public bool IsActive => RevokedAt is null && DateTimeOffset.UtcNow <= ExpiresAt;
}

public sealed class UserAuditLog : AuditableEntity
{
    public Guid? ActorUserId { get; set; }
    public required string ActorEmail { get; set; }
    public required string ActorFullName { get; set; }
    public required string ActorRole { get; set; }
    public Guid TargetUserId { get; set; }
    public required string TargetEmail { get; set; }
    public required string TargetFullName { get; set; }
    public required string Action { get; set; }
    public string? Details { get; set; }
}