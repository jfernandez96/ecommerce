using Ecommerce.Application.Auth;
using Ecommerce.Application.Common;
using Ecommerce.Domain.Users;
using FluentValidation;
using MediatR;

namespace Ecommerce.Application.Users;

public sealed record ListUsersQuery(string? Query, string? Role, bool? IsActive, int Page = 1, int PageSize = 20) : IRequest<PagedResult<AdminUserDto>>;
public sealed record CreateUserCommand(string Email, string FullName, string Password, string Role, bool IsActive) : IRequest<Guid>;
public sealed record UpdateUserProfileCommand(Guid Id, string Email, string FullName) : IRequest<bool>;
public sealed record SetUserRoleCommand(Guid Id, string Role) : IRequest<bool>;
public sealed record SetUserStatusCommand(Guid Id, bool IsActive) : IRequest<bool>;
public sealed record ResetUserPasswordCommand(Guid Id, string NewPassword) : IRequest<bool>;
public sealed record ListUserAuditLogsQuery(Guid? TargetUserId, string? Action, int Page = 1, int PageSize = 20) : IRequest<PagedResult<AdminUserAuditLogDto>>;

public sealed record AdminUserDto(Guid Id, string Email, string FullName, string Role, bool IsActive, DateTimeOffset CreatedAt);
public sealed record AdminUserAuditLogDto(Guid Id, string Action, string ActorEmail, string ActorFullName, string ActorRole, Guid TargetUserId, string TargetEmail, string TargetFullName, string? Details, DateTimeOffset CreatedAt);

public sealed record UserListRequest(string? Query, UserRole? Role, bool? IsActive, int Page, int PageSize);
public sealed record UserAuditListRequest(Guid? TargetUserId, string? Action, int Page, int PageSize);

public static class UserAuditActions
{
    public const string Created = "users.created";
    public const string ProfileUpdated = "users.profile-updated";
    public const string RoleChanged = "users.role-changed";
    public const string StatusChanged = "users.status-changed";
    public const string PasswordReset = "users.password-reset";
}

public sealed class CreateUserCommandValidator : AbstractValidator<CreateUserCommand>
{
    public CreateUserCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(180);
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8).MaximumLength(120);
        RuleFor(x => x.Role).NotEmpty().Must(BeValidRole).WithMessage("Rol invalido. Usa Administrator, Employee o Customer.");
    }

    private static bool BeValidRole(string role) => Enum.TryParse<UserRole>(role, true, out _);
}

public sealed class SetUserRoleCommandValidator : AbstractValidator<SetUserRoleCommand>
{
    public SetUserRoleCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Role).NotEmpty().Must(BeValidRole).WithMessage("Rol invalido. Usa Administrator, Employee o Customer.");
    }

    private static bool BeValidRole(string role) => Enum.TryParse<UserRole>(role, true, out _);
}

public sealed class UpdateUserProfileCommandValidator : AbstractValidator<UpdateUserProfileCommand>
{
    public UpdateUserProfileCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(180);
    }
}

public sealed class ResetUserPasswordCommandValidator : AbstractValidator<ResetUserPasswordCommand>
{
    public ResetUserPasswordCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.NewPassword).NotEmpty().MinimumLength(8).MaximumLength(120);
    }
}

public sealed class ListUsersQueryValidator : AbstractValidator<ListUsersQuery>
{
    public ListUsersQueryValidator()
    {
        RuleFor(x => x.Page).GreaterThanOrEqualTo(1);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
        RuleFor(x => x.Role)
            .Must(role => string.IsNullOrWhiteSpace(role) || Enum.TryParse<UserRole>(role, true, out _))
            .WithMessage("Rol invalido. Usa Administrator, Employee o Customer.");
    }
}

public sealed class ListUserAuditLogsQueryValidator : AbstractValidator<ListUserAuditLogsQuery>
{
    public ListUserAuditLogsQueryValidator()
    {
        RuleFor(x => x.Page).GreaterThanOrEqualTo(1);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
    }
}

public sealed class ListUsersQueryHandler(IUserRepository users)
    : IRequestHandler<ListUsersQuery, PagedResult<AdminUserDto>>
{
    public async Task<PagedResult<AdminUserDto>> Handle(ListUsersQuery request, CancellationToken cancellationToken)
    {
        UserRole? parsedRole = null;
        if (!string.IsNullOrWhiteSpace(request.Role))
        {
            parsedRole = Enum.Parse<UserRole>(request.Role, true);
        }

        var result = await users.SearchAsync(new UserListRequest(
            request.Query?.Trim(),
            parsedRole,
            request.IsActive,
            Math.Max(1, request.Page),
            Math.Clamp(request.PageSize, 1, 100)), cancellationToken);

        var items = result.Items.Select(user => new AdminUserDto(
            user.Id,
            user.Email,
            user.FullName,
            user.Role.ToString(),
            user.IsActive,
            user.CreatedAt)).ToArray();

        return new PagedResult<AdminUserDto>(items, result.Page, result.PageSize, result.TotalItems);
    }
}

public sealed class CreateUserCommandHandler(IUserRepository users, IPasswordHasher passwordHasher, IUnitOfWork unitOfWork, ICurrentUserContext currentUser)
    : IRequestHandler<CreateUserCommand, Guid>
{
    public async Task<Guid> Handle(CreateUserCommand request, CancellationToken cancellationToken)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        if (await users.ExistsByEmailAsync(normalizedEmail, cancellationToken))
        {
            throw new ValidationException("Ya existe un usuario con ese correo.");
        }

        if (!Enum.TryParse<UserRole>(request.Role, true, out var role))
        {
            throw new ValidationException("Rol invalido.");
        }

        var user = new AppUser
        {
            Email = normalizedEmail,
            FullName = request.FullName.Trim(),
            PasswordHash = passwordHasher.Hash(request.Password),
            Role = role,
            IsActive = request.IsActive,
        };

        await users.AddAsync(user, cancellationToken);
        await users.AddUserAuditLogAsync(UserAuditLogFactory.Build(
            currentUser,
            user,
            UserAuditActions.Created,
            $"Rol inicial: {user.Role}. Estado inicial: {(user.IsActive ? "Activo" : "Inactivo")}."), cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return user.Id;
    }
}

public sealed class SetUserRoleCommandHandler(IUserRepository users, IUnitOfWork unitOfWork, ICurrentUserContext currentUser)
    : IRequestHandler<SetUserRoleCommand, bool>
{
    public async Task<bool> Handle(SetUserRoleCommand request, CancellationToken cancellationToken)
    {
        var user = await users.GetByIdAsync(request.Id, cancellationToken);
        if (user is null)
        {
            return false;
        }

        var previousRole = user.Role;
        user.Role = Enum.Parse<UserRole>(request.Role, true);
        await users.AddUserAuditLogAsync(UserAuditLogFactory.Build(
            currentUser,
            user,
            UserAuditActions.RoleChanged,
            $"Rol cambiado de {previousRole} a {user.Role}."), cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public sealed class UpdateUserProfileCommandHandler(IUserRepository users, IUnitOfWork unitOfWork, ICurrentUserContext currentUser)
    : IRequestHandler<UpdateUserProfileCommand, bool>
{
    public async Task<bool> Handle(UpdateUserProfileCommand request, CancellationToken cancellationToken)
    {
        var user = await users.GetByIdAsync(request.Id, cancellationToken);
        if (user is null)
        {
            return false;
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        if (!string.Equals(user.Email, normalizedEmail, StringComparison.OrdinalIgnoreCase)
            && await users.ExistsByEmailAsync(normalizedEmail, cancellationToken))
        {
            throw new ValidationException("Ya existe un usuario con ese correo.");
        }

        var previousFullName = user.FullName;
        var previousEmail = user.Email;

        user.Email = normalizedEmail;
        user.FullName = request.FullName.Trim();

        await users.AddUserAuditLogAsync(UserAuditLogFactory.Build(
            currentUser,
            user,
            UserAuditActions.ProfileUpdated,
            $"Perfil actualizado. Nombre: '{previousFullName}' -> '{user.FullName}'. Correo: '{previousEmail}' -> '{user.Email}'."), cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public sealed class SetUserStatusCommandHandler(IUserRepository users, IUnitOfWork unitOfWork, ICurrentUserContext currentUser)
    : IRequestHandler<SetUserStatusCommand, bool>
{
    public async Task<bool> Handle(SetUserStatusCommand request, CancellationToken cancellationToken)
    {
        var user = await users.GetByIdAsync(request.Id, cancellationToken);
        if (user is null)
        {
            return false;
        }

        var previousStatus = user.IsActive;
        user.IsActive = request.IsActive;
        await users.AddUserAuditLogAsync(UserAuditLogFactory.Build(
            currentUser,
            user,
            UserAuditActions.StatusChanged,
            $"Estado cambiado de {(previousStatus ? "Activo" : "Inactivo")} a {(request.IsActive ? "Activo" : "Inactivo")}."), cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public sealed class ResetUserPasswordCommandHandler(IUserRepository users, IPasswordHasher passwordHasher, IUnitOfWork unitOfWork, ICurrentUserContext currentUser)
    : IRequestHandler<ResetUserPasswordCommand, bool>
{
    public async Task<bool> Handle(ResetUserPasswordCommand request, CancellationToken cancellationToken)
    {
        var user = await users.GetByIdAsync(request.Id, cancellationToken);
        if (user is null)
        {
            return false;
        }

        user.PasswordHash = passwordHasher.Hash(request.NewPassword);
        await users.AddUserAuditLogAsync(UserAuditLogFactory.Build(
            currentUser,
            user,
            UserAuditActions.PasswordReset,
            "Contrasena restablecida por un usuario con permisos de gestion."), cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public sealed class ListUserAuditLogsQueryHandler(IUserRepository users)
    : IRequestHandler<ListUserAuditLogsQuery, PagedResult<AdminUserAuditLogDto>>
{
    public async Task<PagedResult<AdminUserAuditLogDto>> Handle(ListUserAuditLogsQuery request, CancellationToken cancellationToken)
    {
        var result = await users.SearchUserAuditLogsAsync(new UserAuditListRequest(
            request.TargetUserId,
            request.Action?.Trim(),
            Math.Max(1, request.Page),
            Math.Clamp(request.PageSize, 1, 100)), cancellationToken);

        var items = result.Items.Select(log => new AdminUserAuditLogDto(
            log.Id,
            log.Action,
            log.ActorEmail,
            log.ActorFullName,
            log.ActorRole,
            log.TargetUserId,
            log.TargetEmail,
            log.TargetFullName,
            log.Details,
            log.CreatedAt)).ToArray();

        return new PagedResult<AdminUserAuditLogDto>(items, result.Page, result.PageSize, result.TotalItems);
    }
}

file static class UserAuditLogFactory
{
    public static UserAuditLog Build(ICurrentUserContext currentUser, AppUser target, string action, string details)
    {
        var actorRole = string.IsNullOrWhiteSpace(currentUser.Role) ? "Unknown" : currentUser.Role!;
        var actorEmail = string.IsNullOrWhiteSpace(currentUser.Email) ? "unknown@system.local" : currentUser.Email!;
        var actorName = string.IsNullOrWhiteSpace(currentUser.FullName) ? "Unknown" : currentUser.FullName!;

        return new UserAuditLog
        {
            ActorUserId = currentUser.UserId,
            ActorEmail = actorEmail,
            ActorFullName = actorName,
            ActorRole = actorRole,
            TargetUserId = target.Id,
            TargetEmail = target.Email,
            TargetFullName = target.FullName,
            Action = action,
            Details = details,
        };
    }
}
