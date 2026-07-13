using Ecommerce.Application.Common;
using Ecommerce.Application.Products;
using Ecommerce.Domain.Catalog;
using FluentValidation;
using MediatR;

namespace Ecommerce.Application.Banners;

public sealed record ListBannersQuery(bool ActiveOnly = true) : IRequest<IReadOnlyList<BannerDto>>;
public sealed record GetBannerQuery(Guid Id) : IRequest<BannerDto?>;
public sealed record CreateBannerCommand(string Title, string Subtitle, string ImageUrl, string? LinkUrl, string Placement, int SortOrder, DateTimeOffset? StartsAt, DateTimeOffset? EndsAt, bool IsActive) : IRequest<Guid>;
public sealed record UpdateBannerCommand(Guid Id, string Title, string Subtitle, string ImageUrl, string? LinkUrl, string Placement, int SortOrder, DateTimeOffset? StartsAt, DateTimeOffset? EndsAt, bool IsActive) : IRequest<bool>;
public sealed record DeleteBannerCommand(Guid Id) : IRequest<bool>;
public sealed record SetBannerStatusCommand(Guid Id, bool IsActive) : IRequest<bool>;

public sealed class CreateBannerCommandValidator : AbstractValidator<CreateBannerCommand>
{
    public CreateBannerCommandValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(180);
        RuleFor(x => x.ImageUrl).NotEmpty();
        RuleFor(x => x.Placement).NotEmpty().MaximumLength(80);
        RuleFor(x => x.SortOrder).GreaterThanOrEqualTo(0);
        RuleFor(x => x.EndsAt).GreaterThan(x => x.StartsAt).When(x => x.StartsAt.HasValue && x.EndsAt.HasValue);
    }
}

public sealed class UpdateBannerCommandValidator : AbstractValidator<UpdateBannerCommand>
{
    public UpdateBannerCommandValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(180);
        RuleFor(x => x.ImageUrl).NotEmpty();
        RuleFor(x => x.Placement).NotEmpty().MaximumLength(80);
        RuleFor(x => x.SortOrder).GreaterThanOrEqualTo(0);
        RuleFor(x => x.EndsAt).GreaterThan(x => x.StartsAt).When(x => x.StartsAt.HasValue && x.EndsAt.HasValue);
    }
}

public sealed class ListBannersQueryHandler(IBannerRepository banners) : IRequestHandler<ListBannersQuery, IReadOnlyList<BannerDto>>
{
    public async Task<IReadOnlyList<BannerDto>> Handle(ListBannersQuery request, CancellationToken cancellationToken) =>
        (await banners.ListAsync(request.ActiveOnly, cancellationToken)).Select(ToDto).ToArray();

    private static BannerDto ToDto(Banner banner) => new(banner.Id, banner.Title, banner.Subtitle, banner.ImageUrl, banner.LinkUrl, banner.Placement, banner.SortOrder, banner.StartsAt, banner.EndsAt, banner.IsActive, banner.CreatedAt);
}

public sealed class GetBannerQueryHandler(IBannerRepository banners) : IRequestHandler<GetBannerQuery, BannerDto?>
{
    public async Task<BannerDto?> Handle(GetBannerQuery request, CancellationToken cancellationToken)
    {
        var banner = await banners.GetByIdAsync(request.Id, cancellationToken);
        return banner is null ? null : new BannerDto(banner.Id, banner.Title, banner.Subtitle, banner.ImageUrl, banner.LinkUrl, banner.Placement, banner.SortOrder, banner.StartsAt, banner.EndsAt, banner.IsActive, banner.CreatedAt);
    }
}

public sealed class CreateBannerCommandHandler(IBannerRepository banners, IUnitOfWork unitOfWork, IProductImageStorageService imageStorage) : IRequestHandler<CreateBannerCommand, Guid>
{
    public async Task<Guid> Handle(CreateBannerCommand request, CancellationToken cancellationToken)
    {
        var normalizedImageUrl = await imageStorage.NormalizeUrlAsync(request.ImageUrl, "banners", cancellationToken) ?? request.ImageUrl;
        var banner = new Banner { Title = request.Title, Subtitle = request.Subtitle, ImageUrl = normalizedImageUrl, LinkUrl = request.LinkUrl, Placement = request.Placement, SortOrder = request.SortOrder, StartsAt = request.StartsAt, EndsAt = request.EndsAt, IsActive = request.IsActive };
        await banners.AddAsync(banner, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return banner.Id;
    }
}

public sealed class UpdateBannerCommandHandler(IBannerRepository banners, IUnitOfWork unitOfWork, IProductImageStorageService imageStorage) : IRequestHandler<UpdateBannerCommand, bool>
{
    public async Task<bool> Handle(UpdateBannerCommand request, CancellationToken cancellationToken)
    {
        var banner = await banners.GetByIdAsync(request.Id, cancellationToken);
        if (banner is null) return false;
        var normalizedImageUrl = await imageStorage.NormalizeUrlAsync(request.ImageUrl, "banners", cancellationToken) ?? request.ImageUrl;
        banner.Title = request.Title;
        banner.Subtitle = request.Subtitle;
        banner.ImageUrl = normalizedImageUrl;
        banner.LinkUrl = request.LinkUrl;
        banner.Placement = request.Placement;
        banner.SortOrder = request.SortOrder;
        banner.StartsAt = request.StartsAt;
        banner.EndsAt = request.EndsAt;
        banner.IsActive = request.IsActive;
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public sealed class DeleteBannerCommandHandler(IBannerRepository banners, IUnitOfWork unitOfWork) : IRequestHandler<DeleteBannerCommand, bool>
{
    public async Task<bool> Handle(DeleteBannerCommand request, CancellationToken cancellationToken)
    {
        var banner = await banners.GetByIdAsync(request.Id, cancellationToken);
        if (banner is null) return false;
        banners.Remove(banner);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public sealed class SetBannerStatusCommandHandler(IBannerRepository banners, IUnitOfWork unitOfWork) : IRequestHandler<SetBannerStatusCommand, bool>
{
    public async Task<bool> Handle(SetBannerStatusCommand request, CancellationToken cancellationToken)
    {
        var banner = await banners.GetByIdAsync(request.Id, cancellationToken);
        if (banner is null) return false;
        banner.IsActive = request.IsActive;
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }
}