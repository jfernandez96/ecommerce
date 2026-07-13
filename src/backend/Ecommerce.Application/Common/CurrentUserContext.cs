namespace Ecommerce.Application.Common;

public interface ICurrentUserContext
{
    Guid? UserId { get; }
    string? Email { get; }
    string? FullName { get; }
    string? Role { get; }
}