using Ecommerce.Application.Common;
using MediatR;

namespace Ecommerce.Application.Products;

public sealed record SearchProductsQuery(ProductSearchRequest Request) : IRequest<PagedResult<ProductSummaryDto>>;

public sealed class SearchProductsQueryHandler(IProductReadService productReadService)
    : IRequestHandler<SearchProductsQuery, PagedResult<ProductSummaryDto>>
{
    public Task<PagedResult<ProductSummaryDto>> Handle(SearchProductsQuery request, CancellationToken cancellationToken) =>
        productReadService.SearchAsync(request.Request, cancellationToken);
}

public sealed record GetProductBySlugQuery(string Slug) : IRequest<ProductDetailDto?>;

public sealed class GetProductBySlugQueryHandler(IProductRepository products, IStoreLocationRepository stores)
    : IRequestHandler<GetProductBySlugQuery, ProductDetailDto?>
{
    public async Task<ProductDetailDto?> Handle(GetProductBySlugQuery request, CancellationToken cancellationToken)
    {
        var product = await products.GetBySlugAsync(request.Slug, cancellationToken);
        if (product is null)
        {
            return null;
        }

        var storeStocks = await stores.GetProductStocksAsync(product.Id, cancellationToken);

        return new ProductDetailDto(
            product.Id,
            product.Name,
            product.Slug,
            product.Sku,
            product.Code,
            product.Brand?.Name ?? string.Empty,
            product.Category?.Name ?? string.Empty,
            product.Description,
            product.LongDescription,
            product.RegularPrice,
            product.SalePrice,
            product.Stock,
            product.WeightKg,
            product.Material,
            product.VideoUrl,
            product.Images.OrderBy(image => image.SortOrder).Select(image => new ProductImageDto(image.Url, image.AltText, image.IsPrimary, image.Color)).ToArray(),
            product.Variants.Where(variant => variant.IsActive).Select(variant => new ProductVariantDto(variant.Id, variant.Sku, variant.Color, variant.Size, variant.Stock, variant.PriceAdjustment)).ToArray(),
            product.Tags.Select(tag => tag.Name).ToArray(),
            storeStocks);
    }
}