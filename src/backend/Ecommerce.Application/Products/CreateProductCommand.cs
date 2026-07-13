using Ecommerce.Application.Common;
using Ecommerce.Domain.Catalog;
using FluentValidation;
using FluentValidation.Results;
using MediatR;

namespace Ecommerce.Application.Products;

public sealed record ProductVariantInput(string Color, string Size, int Stock, decimal? PriceAdjustment);
public sealed record ProductImageInput(string Url, string? Color);

public sealed record CreateProductCommand(
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
    ProductStatus Status,
    IReadOnlyList<ProductVariantInput>? Variants,
    IReadOnlyList<ProductImageInput>? Images) : IRequest<Guid>;

public sealed class CreateProductCommandValidator : AbstractValidator<CreateProductCommand>
{
    public CreateProductCommandValidator()
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

public sealed class CreateProductCommandHandler(IProductRepository products, IStoreLocationRepository stores, IUnitOfWork unitOfWork, IProductImageStorageService imageStorage)
    : IRequestHandler<CreateProductCommand, Guid>
{
    private static string BuildVariantSku(string productSku, string size, string color, int index)
    {
        var normalizedSize = new string(size.ToLowerInvariant().Where(ch => char.IsLetterOrDigit(ch)).ToArray());
        var normalizedColor = new string(color.ToLowerInvariant().Where(ch => char.IsLetterOrDigit(ch)).ToArray());
        var candidate = $"{productSku}-{normalizedSize}-{normalizedColor}-{index + 1}";
        return candidate.Length <= 90 ? candidate : candidate[..90];
    }

    private static async Task EnsureSlugIsAvailableAsync(IProductRepository products, string slug, CancellationToken cancellationToken)
    {
        var existingProduct = await products.GetBySlugAsync(slug, cancellationToken);
        if (existingProduct is null) return;

        throw new ValidationException([
            new ValidationFailure(nameof(CreateProductCommand.Slug), "Ya existe un producto con el mismo nombre o slug. Usa uno diferente.")
        ]);
    }

    public async Task<Guid> Handle(CreateProductCommand request, CancellationToken cancellationToken)
    {
        await EnsureSlugIsAvailableAsync(products, request.Slug, cancellationToken);

        var product = new Product
        {
            Name = request.Name,
            Slug = request.Slug,
            Sku = request.Sku,
            Code = request.Code,
            BrandId = request.BrandId,
            CategoryId = request.CategoryId,
            SubcategoryId = request.SubcategoryId,
            MainStoreId = request.MainStoreId,
            RegularPrice = request.RegularPrice,
            SalePrice = request.SalePrice,
            Cost = request.Cost,
            Stock = request.Stock,
            MinimumStock = request.MinimumStock,
            WeightKg = request.WeightKg,
            Material = request.Material,
            Description = request.Description,
            LongDescription = request.LongDescription,
            VideoUrl = request.VideoUrl,
            SeoTitle = request.SeoTitle,
            SeoDescription = request.SeoDescription,
            Status = request.Status
        };

        var normalizedImages = await imageStorage.NormalizeAsync(request.Images ?? [], cancellationToken);

        foreach (var image in normalizedImages
                     .Where(image => !string.IsNullOrWhiteSpace(image.Url))
                     .Select((image, index) => new { image, index }))
        {
            product.Images.Add(new ProductImage
            {
                ProductId = product.Id,
                Url = image.image.Url,
                AltText = product.Name,
                Color = string.IsNullOrWhiteSpace(image.image.Color) ? null : image.image.Color.Trim(),
                SortOrder = image.index,
                IsPrimary = image.index == 0
            });
        }

        var variants = (request.Variants ?? [])
            .Where(variant => !string.IsNullOrWhiteSpace(variant.Size) && !string.IsNullOrWhiteSpace(variant.Color))
            .Select(variant => new
            {
                Size = variant.Size.Trim(),
                Color = variant.Color.Trim(),
                variant.Stock,
                variant.PriceAdjustment
            })
            .DistinctBy(variant => $"{variant.Size}|{variant.Color}", StringComparer.OrdinalIgnoreCase)
            .ToArray();

        foreach (var variant in variants.Select((item, index) => new { item, index }))
        {
            product.Variants.Add(new ProductVariant
            {
                ProductId = product.Id,
                Sku = BuildVariantSku(product.Sku, variant.item.Size, variant.item.Color, variant.index),
                Color = variant.item.Color,
                Size = variant.item.Size,
                Stock = variant.item.Stock,
                PriceAdjustment = variant.item.PriceAdjustment,
                IsActive = true
            });
        }

        if (variants.Length > 0)
        {
            product.Stock = variants.Sum(variant => variant.Stock);
        }

        await products.AddAsync(product, cancellationToken);

        var mainStoreStock = await stores.GetOrCreateProductStockAsync(request.MainStoreId, product.Id, cancellationToken);
        if (product.Stock > 0)
        {
            var distributedStock = await stores.GetProductStocksAsync(product.Id, cancellationToken);
            if (distributedStock.Sum(item => item.Stock) <= 0)
            {
                mainStoreStock.Stock = product.Stock;
            }
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return product.Id;
    }
}