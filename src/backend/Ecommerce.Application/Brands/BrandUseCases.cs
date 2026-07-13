using Ecommerce.Application.Common;
using Ecommerce.Domain.Catalog;
using FluentValidation;
using MediatR;

namespace Ecommerce.Application.Brands;

public sealed record ListBrandsQuery : IRequest<IReadOnlyList<BrandDto>>;
public sealed record GetBrandQuery(Guid Id) : IRequest<BrandDto?>;
public sealed record CreateBrandCommand(string Name, string Slug, string? LogoUrl, bool IsActive) : IRequest<Guid>;
public sealed record UpdateBrandCommand(Guid Id, string Name, string Slug, string? LogoUrl, bool IsActive) : IRequest<bool>;
public sealed record DeleteBrandCommand(Guid Id) : IRequest<bool>;
public sealed record SetBrandStatusCommand(Guid Id, bool IsActive) : IRequest<bool>;

public sealed class CreateBrandCommandValidator : AbstractValidator<CreateBrandCommand>
{
    public CreateBrandCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(140);
        RuleFor(x => x.Slug).NotEmpty().MaximumLength(180).Matches("^[a-z0-9]+(?:-[a-z0-9]+)*$");
    }
}

public sealed class UpdateBrandCommandValidator : AbstractValidator<UpdateBrandCommand>
{
    public UpdateBrandCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(140);
        RuleFor(x => x.Slug).NotEmpty().MaximumLength(180).Matches("^[a-z0-9]+(?:-[a-z0-9]+)*$");
    }
}

public sealed class ListBrandsQueryHandler(IBrandRepository brands) : IRequestHandler<ListBrandsQuery, IReadOnlyList<BrandDto>>
{
    public async Task<IReadOnlyList<BrandDto>> Handle(ListBrandsQuery request, CancellationToken cancellationToken) =>
        (await brands.ListAsync(cancellationToken)).OrderBy(x => x.Name).Select(ToDto).ToArray();

    private static BrandDto ToDto(Brand brand) => new(brand.Id, brand.Name, brand.Slug, brand.LogoUrl, brand.IsActive, brand.CreatedAt);
}

public sealed class GetBrandQueryHandler(IBrandRepository brands) : IRequestHandler<GetBrandQuery, BrandDto?>
{
    public async Task<BrandDto?> Handle(GetBrandQuery request, CancellationToken cancellationToken)
    {
        var brand = await brands.GetByIdAsync(request.Id, cancellationToken);
        return brand is null ? null : new BrandDto(brand.Id, brand.Name, brand.Slug, brand.LogoUrl, brand.IsActive, brand.CreatedAt);
    }
}

public sealed class CreateBrandCommandHandler(IBrandRepository brands, IUnitOfWork unitOfWork) : IRequestHandler<CreateBrandCommand, Guid>
{
    public async Task<Guid> Handle(CreateBrandCommand request, CancellationToken cancellationToken)
    {
        var brand = new Brand { Name = request.Name, Slug = request.Slug, LogoUrl = request.LogoUrl, IsActive = request.IsActive };
        await brands.AddAsync(brand, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return brand.Id;
    }
}

public sealed class UpdateBrandCommandHandler(IBrandRepository brands, IUnitOfWork unitOfWork) : IRequestHandler<UpdateBrandCommand, bool>
{
    public async Task<bool> Handle(UpdateBrandCommand request, CancellationToken cancellationToken)
    {
        var brand = await brands.GetByIdAsync(request.Id, cancellationToken);
        if (brand is null) return false;
        brand.Name = request.Name;
        brand.Slug = request.Slug;
        brand.LogoUrl = request.LogoUrl;
        brand.IsActive = request.IsActive;
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public sealed class DeleteBrandCommandHandler(IBrandRepository brands, IUnitOfWork unitOfWork) : IRequestHandler<DeleteBrandCommand, bool>
{
    public async Task<bool> Handle(DeleteBrandCommand request, CancellationToken cancellationToken)
    {
        var brand = await brands.GetByIdAsync(request.Id, cancellationToken);
        if (brand is null) return false;
        brands.Remove(brand);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public sealed class SetBrandStatusCommandHandler(IBrandRepository brands, IUnitOfWork unitOfWork) : IRequestHandler<SetBrandStatusCommand, bool>
{
    public async Task<bool> Handle(SetBrandStatusCommand request, CancellationToken cancellationToken)
    {
        var brand = await brands.GetByIdAsync(request.Id, cancellationToken);
        if (brand is null) return false;
        brand.IsActive = request.IsActive;
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }
}