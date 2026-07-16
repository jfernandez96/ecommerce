namespace Ecommerce.Application.Products;

public interface IProductImageStorageService
{
    Task<IReadOnlyList<ProductImageInput>> NormalizeAsync(IReadOnlyList<ProductImageInput> images, CancellationToken cancellationToken = default);
    Task<string?> NormalizeUrlAsync(string? imageUrl, string scope, CancellationToken cancellationToken = default);
    Task<string> SaveBinaryImageAsync(byte[] bytes, string contentType, string scope, CancellationToken cancellationToken = default);
    bool IsManagedPath(string? imageUrl, string? scope = null);
    Task DeleteAsync(IEnumerable<string> imageUrls, CancellationToken cancellationToken = default);
}
