using Ecommerce.Application.Common;
using Ecommerce.Domain.Common;
using FluentValidation;
using MediatR;

namespace Ecommerce.Application.Stores;

public sealed record ListStoresQuery(bool ActiveOnly = true) : IRequest<IReadOnlyList<StoreLocationDto>>;
public sealed record CreateStoreCommand(string Name, string Code, string Address, string? District, string? Province, string? Department, string? Phone, string? PickupInstructions, bool IsActive) : IRequest<Guid>;
public sealed record UpdateStoreCommand(Guid Id, string Name, string Code, string Address, string? District, string? Province, string? Department, string? Phone, string? PickupInstructions, bool IsActive) : IRequest<bool>;

public sealed class CreateStoreCommandValidator : AbstractValidator<CreateStoreCommand>
{
    public CreateStoreCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(180);
        RuleFor(x => x.Code).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Address).NotEmpty().MaximumLength(260);
        RuleFor(x => x.District).MaximumLength(160);
        RuleFor(x => x.Province).MaximumLength(140);
        RuleFor(x => x.Department).MaximumLength(120);
        RuleFor(x => x.Phone).MaximumLength(30);
        RuleFor(x => x.PickupInstructions).MaximumLength(400);
    }
}

public sealed class UpdateStoreCommandValidator : AbstractValidator<UpdateStoreCommand>
{
    public UpdateStoreCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(180);
        RuleFor(x => x.Code).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Address).NotEmpty().MaximumLength(260);
        RuleFor(x => x.District).MaximumLength(160);
        RuleFor(x => x.Province).MaximumLength(140);
        RuleFor(x => x.Department).MaximumLength(120);
        RuleFor(x => x.Phone).MaximumLength(30);
        RuleFor(x => x.PickupInstructions).MaximumLength(400);
    }
}

public sealed class ListStoresQueryHandler(IStoreLocationRepository stores)
    : IRequestHandler<ListStoresQuery, IReadOnlyList<StoreLocationDto>>
{
    public async Task<IReadOnlyList<StoreLocationDto>> Handle(ListStoresQuery request, CancellationToken cancellationToken)
    {
        var data = await stores.ListAsync(request.ActiveOnly, cancellationToken);
        return data
            .Select(store => new StoreLocationDto(
                store.Id,
                store.Name,
                store.Code,
                store.Address,
                store.District,
                store.Province,
                store.Department,
                store.Phone,
                store.PickupInstructions,
                store.IsActive,
                store.CreatedAt))
            .ToArray();
    }
}

public sealed class CreateStoreCommandHandler(IStoreLocationRepository stores, IUnitOfWork unitOfWork)
    : IRequestHandler<CreateStoreCommand, Guid>
{
    public async Task<Guid> Handle(CreateStoreCommand request, CancellationToken cancellationToken)
    {
        var store = new StoreLocation
        {
            Name = request.Name.Trim(),
            Code = request.Code.Trim().ToUpperInvariant(),
            Address = request.Address.Trim(),
            District = string.IsNullOrWhiteSpace(request.District) ? null : request.District.Trim(),
            Province = string.IsNullOrWhiteSpace(request.Province) ? null : request.Province.Trim(),
            Department = string.IsNullOrWhiteSpace(request.Department) ? null : request.Department.Trim(),
            Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim(),
            PickupInstructions = string.IsNullOrWhiteSpace(request.PickupInstructions) ? null : request.PickupInstructions.Trim(),
            IsActive = request.IsActive,
        };

        await stores.AddAsync(store, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return store.Id;
    }
}

public sealed class UpdateStoreCommandHandler(IStoreLocationRepository stores, IUnitOfWork unitOfWork)
    : IRequestHandler<UpdateStoreCommand, bool>
{
    public async Task<bool> Handle(UpdateStoreCommand request, CancellationToken cancellationToken)
    {
        var store = await stores.GetByIdAsync(request.Id, cancellationToken);
        if (store is null)
        {
            return false;
        }

        store.Name = request.Name.Trim();
        store.Code = request.Code.Trim().ToUpperInvariant();
        store.Address = request.Address.Trim();
        store.District = string.IsNullOrWhiteSpace(request.District) ? null : request.District.Trim();
        store.Province = string.IsNullOrWhiteSpace(request.Province) ? null : request.Province.Trim();
        store.Department = string.IsNullOrWhiteSpace(request.Department) ? null : request.Department.Trim();
        store.Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();
        store.PickupInstructions = string.IsNullOrWhiteSpace(request.PickupInstructions) ? null : request.PickupInstructions.Trim();
        store.IsActive = request.IsActive;

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }
}
