using Ecommerce.Application.Common;
using Ecommerce.Domain.Catalog;
using FluentValidation;
using FluentValidation.Results;
using MediatR;

namespace Ecommerce.Application.Products;

public sealed record UpdateProductCommand(
    Guid Id,
    string Name,
    string Slug,
    string Sku,
    string Code,
    Guid BrandId,
    Guid CategoryId,
    Guid? SubcategoryId,
    Guid MainStoreId,
    decimal RegularPrice,
    decimal? SalePrice,
    decimal Cost,
    int Stock,
    int MinimumStock,
    decimal WeightKg,
    string Material,
    string Description,
    string LongDescription,
    string? VideoUrl,
    string SeoTitle,
    string SeoDescription,
    IReadOnlyList<ProductVariantInput>? Variants,
    ProductStatus Status,
    IReadOnlyList<ProductImageInput>? Images) : IRequest<bool>;

public sealed record DeleteProductCommand(Guid Id) : IRequest<bool>;
public sealed record SetProductStatusCommand(Guid Id, ProductStatus Status) : IRequest<bool>;
public sealed record GetProductAdminQuery(Guid Id) : IRequest<ProductAdminDto?>;

public sealed class GetProductAdminQueryHandler(IProductRepository products) : IRequestHandler<GetProductAdminQuery, ProductAdminDto?>
{
    public async Task<ProductAdminDto?> Handle(GetProductAdminQuery request, CancellationToken cancellationToken)
    {
        var product = await products.GetByIdAsync(request.Id, cancellationToken);
        return product is null ? null : new ProductAdminDto(
            product.Id,
            product.Name,
            product.Slug,
            product.Sku,
            product.Code,
            product.BrandId,
            product.CategoryId,
            product.SubcategoryId,
            product.MainStoreId,
            product.RegularPrice,
            product.SalePrice,
            product.Cost,
            product.Stock,
            product.MinimumStock,
            product.WeightKg,
            product.Material,
            product.Description,
            product.LongDescription,
            product.VideoUrl,
            product.SeoTitle,
            product.SeoDescription,
            (int)product.Status,
            product.Images.OrderBy(image => image.SortOrder).Select(image => new ProductImageDto(image.Url, image.AltText, image.IsPrimary, image.Color)).ToArray(),
            product.Variants
                .Where(variant => variant.IsActive && !variant.IsDeleted)
                .OrderBy(variant => variant.CreatedAt)
                .Select(variant => new ProductVariantDto(variant.Id, variant.Sku, variant.Color, variant.Size, variant.Stock, variant.PriceAdjustment))
                .ToArray());
    }
}

public sealed class UpdateProductCommandValidator : AbstractValidator<UpdateProductCommand>
{
    public UpdateProductCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(180);
        RuleFor(x => x.Slug).NotEmpty().MaximumLength(220).Matches("^[a-z0-9]+(?:-[a-z0-9]+)*$");
        RuleFor(x => x.Sku).NotEmpty().MaximumLength(80);
        RuleFor(x => x.Code).NotEmpty().MaximumLength(80);
        RuleFor(x => x.MainStoreId).NotEmpty();
        RuleFor(x => x.RegularPrice).GreaterThan(0);
        RuleFor(x => x.SalePrice).LessThan(x => x.RegularPrice).When(x => x.SalePrice.HasValue);
        RuleFor(x => x.Stock).GreaterThanOrEqualTo(0);
        RuleFor(x => x.MinimumStock).GreaterThanOrEqualTo(0);
        RuleForEach(x => x.Variants).ChildRules(variant =>
        {
            variant.RuleFor(x => x.Color).NotEmpty().MaximumLength(60);
            variant.RuleFor(x => x.Size).NotEmpty().MaximumLength(30);
            variant.RuleFor(x => x.Stock).GreaterThanOrEqualTo(0);
        }).When(x => x.Variants is { Count: > 0 });
        RuleForEach(x => x.Images).ChildRules(image =>
        {
            image.RuleFor(x => x.Url).NotEmpty().MaximumLength(2000000);
            image.RuleFor(x => x.Color).MaximumLength(60).When(x => !string.IsNullOrWhiteSpace(x.Color));
        }).When(x => x.Images is { Count: > 0 });
    }
}

public sealed class UpdateProductCommandHandler(IProductRepository products, IStoreLocationRepository stores, IUnitOfWork unitOfWork, IProductImageStorageService imageStorage) : IRequestHandler<UpdateProductCommand, bool>
{
    private static string BuildVariantSku(string productSku, string size, string color, int index)
    {
        var normalizedSize = new string(size.ToLowerInvariant().Where(ch => char.IsLetterOrDigit(ch)).ToArray());
        var normalizedColor = new string(color.ToLowerInvariant().Where(ch => char.IsLetterOrDigit(ch)).ToArray());
        var candidate = $"{productSku}-{normalizedSize}-{normalizedColor}-{index + 1}";
        return candidate.Length <= 90 ? candidate : candidate[..90];
    }

    private static ProductVariantInput[] NormalizeVariants(IReadOnlyList<ProductVariantInput>? variants) =>
        (variants ?? [])
            .Where(variant => !string.IsNullOrWhiteSpace(variant.Size) && !string.IsNullOrWhiteSpace(variant.Color))
            .Select(variant => new ProductVariantInput(variant.Color.Trim(), variant.Size.Trim(), Math.Max(variant.Stock, 0), variant.PriceAdjustment))
            .DistinctBy(variant => $"{variant.Size}|{variant.Color}", StringComparer.OrdinalIgnoreCase)
            .ToArray();

    private static ProductImage[] BuildImages(Product product, IReadOnlyList<ProductImageInput>? images) =>
        (images ?? [])
            .Where(image => !string.IsNullOrWhiteSpace(image.Url))
            .Select(image => new ProductImageInput(image.Url.Trim(), string.IsNullOrWhiteSpace(image.Color) ? null : image.Color.Trim()))
            .DistinctBy(image => $"{image.Url}|{image.Color}", StringComparer.Ordinal)
            .Select((image, index) => new ProductImage
            {
                ProductId = product.Id,
                Url = image.Url,
                AltText = product.Name,
                Color = image.Color,
                SortOrder = index,
                IsPrimary = index == 0
            })
            .ToArray();

    private static async Task EnsureSlugIsAvailableAsync(IProductRepository products, Guid productId, string slug, CancellationToken cancellationToken)
    {
        var existingProduct = await products.GetBySlugAsync(slug, cancellationToken);
        if (existingProduct is null || existingProduct.Id == productId) return;

        throw new ValidationException([
            new ValidationFailure(nameof(UpdateProductCommand.Slug), "Ya existe un producto con el mismo nombre o slug. Usa uno diferente.")
        ]);
    }

    private static bool MatchesRequest(Product product, UpdateProductCommand request)
    {
        if (product.Name != request.Name) return false;
        if (product.Slug != request.Slug) return false;
        if (product.Sku != request.Sku) return false;
        if (product.Code != request.Code) return false;
        if (product.BrandId != request.BrandId) return false;
        if (product.CategoryId != request.CategoryId) return false;
        if (product.SubcategoryId != request.SubcategoryId) return false;
        if (product.MainStoreId != request.MainStoreId) return false;
        if (product.RegularPrice != request.RegularPrice) return false;
        if (product.SalePrice != request.SalePrice) return false;
        if (product.Cost != request.Cost) return false;
        if (product.Stock != request.Stock) return false;
        if (product.MinimumStock != request.MinimumStock) return false;
        if (product.WeightKg != request.WeightKg) return false;
        if (product.Material != request.Material) return false;
        if (product.Description != request.Description) return false;
        if (product.LongDescription != request.LongDescription) return false;
        if (product.VideoUrl != request.VideoUrl) return false;
        if (product.SeoTitle != request.SeoTitle) return false;
        if (product.SeoDescription != request.SeoDescription) return false;
        var requestVariants = NormalizeVariants(request.Variants)
            .OrderBy(variant => variant.Size)
            .ThenBy(variant => variant.Color)
            .Select(variant => $"{variant.Size}|{variant.Color}|{variant.Stock}|{variant.PriceAdjustment}")
            .ToArray();

        var currentVariants = product.Variants
            .Where(variant => variant.IsActive && !variant.IsDeleted)
            .OrderBy(variant => variant.Size)
            .ThenBy(variant => variant.Color)
            .Select(variant => $"{variant.Size}|{variant.Color}|{variant.Stock}|{variant.PriceAdjustment}")
            .ToArray();

        if (!requestVariants.SequenceEqual(currentVariants)) return false;
        if (product.Status != request.Status) return false;

        if (request.Images is null) return true;
        var requestImages = BuildImages(product, request.Images)
            .Select(image => $"{image.Url}|{image.Color}")
            .ToArray();
        var currentImages = product.Images
            .Where(image => !image.IsDeleted)
            .OrderBy(image => image.SortOrder)
            .Select(image => $"{image.Url}|{image.Color}")
            .ToArray();
        return requestImages.SequenceEqual(currentImages);
    }

    public async Task<bool> Handle(UpdateProductCommand request, CancellationToken cancellationToken)
    {
        var product = await products.GetByIdAsync(request.Id, cancellationToken);
        if (product is null) return false;
        var orphanedImages = Array.Empty<string>();

        await EnsureSlugIsAvailableAsync(products, request.Id, request.Slug, cancellationToken);

        product.Name = request.Name;
        product.Slug = request.Slug;
        product.Sku = request.Sku;
        product.Code = request.Code;
        product.BrandId = request.BrandId;
        product.CategoryId = request.CategoryId;
        product.SubcategoryId = request.SubcategoryId;
        product.MainStoreId = request.MainStoreId;
        product.RegularPrice = request.RegularPrice;
        product.SalePrice = request.SalePrice;
        product.Cost = request.Cost;
        product.Stock = request.Stock;
        product.MinimumStock = request.MinimumStock;
        product.WeightKg = request.WeightKg;
        product.Material = request.Material;
        product.Description = request.Description;
        product.LongDescription = request.LongDescription;
        product.VideoUrl = request.VideoUrl;
        product.SeoTitle = request.SeoTitle;
        product.SeoDescription = request.SeoDescription;

        var variants = NormalizeVariants(request.Variants);
        var replacementVariants = variants.Select((item, index) => new ProductVariant
        {
            ProductId = product.Id,
            Sku = BuildVariantSku(request.Sku, item.Size, item.Color, index),
            Color = item.Color,
            Size = item.Size,
            Stock = item.Stock,
            PriceAdjustment = item.PriceAdjustment,
            IsActive = true
        }).ToArray();

        await products.ReplaceVariantsAsync(product.Id, replacementVariants, cancellationToken);

        if (variants.Length > 0)
        {
            product.Stock = variants.Sum(variant => variant.Stock);
        }
        else
        {
            product.Stock = 0;
        }

        product.Status = request.Status;
        if (request.Images is not null)
        {
            var previousManagedImages = product.Images
                .Where(image => !image.IsDeleted && imageStorage.IsManagedPath(image.Url))
                .Select(image => image.Url)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var normalizedImages = await imageStorage.NormalizeAsync(request.Images, cancellationToken);
            var replacementImages = BuildImages(product, normalizedImages);
            await products.ReplaceImagesAsync(product.Id, replacementImages, cancellationToken);

            var managedImagesToKeep = replacementImages
                .Where(image => imageStorage.IsManagedPath(image.Url))
                .Select(image => image.Url)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            orphanedImages = previousManagedImages
                .Where(url => !managedImagesToKeep.Contains(url))
                .ToArray();
        }

        var mainStoreStock = await stores.GetOrCreateProductStockAsync(request.MainStoreId, product.Id, cancellationToken);
        if (product.Stock > 0)
        {
            var distributedStock = await stores.GetProductStocksAsync(product.Id, cancellationToken);
            if (distributedStock.Sum(item => item.Stock) <= 0)
            {
                mainStoreStock.Stock = product.Stock;
            }
        }

        try
        {
            await unitOfWork.SaveChangesAsync(cancellationToken);
            if (orphanedImages.Length > 0)
            {
                await imageStorage.DeleteAsync(orphanedImages, cancellationToken);
            }
            return true;
        }
        catch (Exception exception) when (exception.GetType().Name == "DbUpdateConcurrencyException")
        {
            var currentProduct = await products.GetByIdAsync(request.Id, cancellationToken);
            if (currentProduct is null) return false;
            if (MatchesRequest(currentProduct, request)) return true;
            throw;
        }
    }
}

public sealed class DeleteProductCommandHandler(IProductRepository products, IUnitOfWork unitOfWork) : IRequestHandler<DeleteProductCommand, bool>
{
    public async Task<bool> Handle(DeleteProductCommand request, CancellationToken cancellationToken)
    {
        var product = await products.GetByIdAsync(request.Id, cancellationToken);
        if (product is null) return false;
        products.Remove(product);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public sealed class SetProductStatusCommandHandler(IProductRepository products, IUnitOfWork unitOfWork) : IRequestHandler<SetProductStatusCommand, bool>
{
    public async Task<bool> Handle(SetProductStatusCommand request, CancellationToken cancellationToken)
    {
        var product = await products.GetByIdAsync(request.Id, cancellationToken);
        if (product is null) return false;
        product.Status = request.Status;
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }
}