using Ecommerce.Application.Common;
using Ecommerce.Application.Products;
using Ecommerce.Domain.Catalog;
using FluentValidation;
using MediatR;

namespace Ecommerce.Application.Promotions;

public sealed record ListPromotionsQuery : IRequest<IReadOnlyList<PromotionDto>>;
public sealed record GetPromotionQuery(Guid Id) : IRequest<PromotionDto?>;
public sealed record CreatePromotionCommand(string Name, PromotionType Type, decimal Value, DateTimeOffset StartsAt, DateTimeOffset EndsAt, string? BannerUrl, Guid? ProductId, Guid? CategoryId, Guid? BrandId, bool IsActive) : IRequest<Guid>;
public sealed record UpdatePromotionCommand(Guid Id, string Name, PromotionType Type, decimal Value, DateTimeOffset StartsAt, DateTimeOffset EndsAt, string? BannerUrl, Guid? ProductId, Guid? CategoryId, Guid? BrandId, bool IsActive) : IRequest<bool>;
public sealed record DeletePromotionCommand(Guid Id) : IRequest<bool>;
public sealed record DuplicatePromotionCommand(Guid Id) : IRequest<Guid?>;
public sealed record SetPromotionStatusCommand(Guid Id, bool IsActive) : IRequest<bool>;

public sealed class CreatePromotionCommandValidator : AbstractValidator<CreatePromotionCommand>
{
    public CreatePromotionCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(180);
        RuleFor(x => x.Value).GreaterThanOrEqualTo(0);
        RuleFor(x => x.EndsAt).GreaterThan(x => x.StartsAt);
    }
}

public sealed class UpdatePromotionCommandValidator : AbstractValidator<UpdatePromotionCommand>
{
    public UpdatePromotionCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(180);
        RuleFor(x => x.Value).GreaterThanOrEqualTo(0);
        RuleFor(x => x.EndsAt).GreaterThan(x => x.StartsAt);
    }
}

public sealed class ListPromotionsQueryHandler(IPromotionRepository promotions) : IRequestHandler<ListPromotionsQuery, IReadOnlyList<PromotionDto>>
{
    public async Task<IReadOnlyList<PromotionDto>> Handle(ListPromotionsQuery request, CancellationToken cancellationToken) =>
        (await promotions.ListAsync(cancellationToken)).OrderByDescending(x => x.StartsAt).Select(ToDto).ToArray();

    private static PromotionDto ToDto(Promotion promotion) => new(promotion.Id, promotion.Name, promotion.Type.ToString(), promotion.Value, promotion.StartsAt, promotion.EndsAt, promotion.BannerUrl, promotion.IsActive, promotion.ProductId, promotion.CategoryId, promotion.BrandId);
}

public sealed class GetPromotionQueryHandler(IPromotionRepository promotions) : IRequestHandler<GetPromotionQuery, PromotionDto?>
{
    public async Task<PromotionDto?> Handle(GetPromotionQuery request, CancellationToken cancellationToken)
    {
        var promotion = await promotions.GetByIdAsync(request.Id, cancellationToken);
        return promotion is null ? null : new PromotionDto(promotion.Id, promotion.Name, promotion.Type.ToString(), promotion.Value, promotion.StartsAt, promotion.EndsAt, promotion.BannerUrl, promotion.IsActive, promotion.ProductId, promotion.CategoryId, promotion.BrandId);
    }
}

public sealed class CreatePromotionCommandHandler(IPromotionRepository promotions, IUnitOfWork unitOfWork, IProductImageStorageService imageStorage) : IRequestHandler<CreatePromotionCommand, Guid>
{
    public async Task<Guid> Handle(CreatePromotionCommand request, CancellationToken cancellationToken)
    {
        if (request.IsActive)
        {
            var activePromotions = await promotions.CountActiveAsync(cancellationToken: cancellationToken);
            if (activePromotions > 0)
            {
                throw new ValidationException("Solo puede haber una promocion activa a la vez.");
            }
        }

        var normalizedBannerUrl = await imageStorage.NormalizeUrlAsync(request.BannerUrl, "promotions", cancellationToken);
        var promotion = new Promotion { Name = request.Name, Type = request.Type, Value = request.Value, StartsAt = request.StartsAt, EndsAt = request.EndsAt, BannerUrl = normalizedBannerUrl, ProductId = request.ProductId, CategoryId = request.CategoryId, BrandId = request.BrandId, IsActive = request.IsActive };
        await promotions.AddAsync(promotion, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return promotion.Id;
    }
}

public sealed class UpdatePromotionCommandHandler(IPromotionRepository promotions, IUnitOfWork unitOfWork, IProductImageStorageService imageStorage) : IRequestHandler<UpdatePromotionCommand, bool>
{
    public async Task<bool> Handle(UpdatePromotionCommand request, CancellationToken cancellationToken)
    {
        var promotion = await promotions.GetByIdAsync(request.Id, cancellationToken);
        if (promotion is null) return false;

        if (request.IsActive)
        {
            var activePromotions = await promotions.CountActiveAsync(request.Id, cancellationToken);
            if (activePromotions > 0)
            {
                throw new ValidationException("Solo puede haber una promocion activa a la vez.");
            }
        }

        var normalizedBannerUrl = await imageStorage.NormalizeUrlAsync(request.BannerUrl, "promotions", cancellationToken);
        promotion.Name = request.Name;
        promotion.Type = request.Type;
        promotion.Value = request.Value;
        promotion.StartsAt = request.StartsAt;
        promotion.EndsAt = request.EndsAt;
        promotion.BannerUrl = normalizedBannerUrl;
        promotion.ProductId = request.ProductId;
        promotion.CategoryId = request.CategoryId;
        promotion.BrandId = request.BrandId;
        promotion.IsActive = request.IsActive;
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public sealed class DeletePromotionCommandHandler(IPromotionRepository promotions, IUnitOfWork unitOfWork) : IRequestHandler<DeletePromotionCommand, bool>
{
    public async Task<bool> Handle(DeletePromotionCommand request, CancellationToken cancellationToken)
    {
        var promotion = await promotions.GetByIdAsync(request.Id, cancellationToken);
        if (promotion is null) return false;

        promotions.Remove(promotion);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public sealed class DuplicatePromotionCommandHandler(IPromotionRepository promotions, IUnitOfWork unitOfWork) : IRequestHandler<DuplicatePromotionCommand, Guid?>
{
    public async Task<Guid?> Handle(DuplicatePromotionCommand request, CancellationToken cancellationToken)
    {
        var promotion = await promotions.GetByIdAsync(request.Id, cancellationToken);
        if (promotion is null) return null;
        var copy = new Promotion { Name = $"{promotion.Name} copia", Type = promotion.Type, Value = promotion.Value, StartsAt = promotion.StartsAt, EndsAt = promotion.EndsAt, BannerUrl = promotion.BannerUrl, ProductId = promotion.ProductId, CategoryId = promotion.CategoryId, BrandId = promotion.BrandId, IsActive = false };
        await promotions.AddAsync(copy, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return copy.Id;
    }
}

public sealed class SetPromotionStatusCommandHandler(IPromotionRepository promotions, IUnitOfWork unitOfWork) : IRequestHandler<SetPromotionStatusCommand, bool>
{
    public async Task<bool> Handle(SetPromotionStatusCommand request, CancellationToken cancellationToken)
    {
        var promotion = await promotions.GetByIdAsync(request.Id, cancellationToken);
        if (promotion is null) return false;

        if (request.IsActive)
        {
            var activePromotions = await promotions.CountActiveAsync(request.Id, cancellationToken);
            if (activePromotions > 0)
            {
                throw new ValidationException("Solo puede haber una promocion activa a la vez.");
            }
        }

        promotion.IsActive = request.IsActive;
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }
}