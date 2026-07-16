using System.Globalization;
using Ecommerce.Application.Products;
using Microsoft.Extensions.Logging;

namespace Ecommerce.Infrastructure.Media;

public sealed class LocalProductImageStorageService(ILogger<LocalProductImageStorageService> logger) : IProductImageStorageService
{
    private const string UploadsPrefix = "/uploads/";
    private const string ProductScope = "products";
    private const int MaxImageBytes = 25 * 1024 * 1024;
    private static readonly Dictionary<string, string> MimeToExtension = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/jpeg"] = ".jpg",
        ["image/jpg"] = ".jpg",
        ["image/png"] = ".png",
        ["image/webp"] = ".webp",
        ["image/gif"] = ".gif"
    };

    public async Task<IReadOnlyList<ProductImageInput>> NormalizeAsync(IReadOnlyList<ProductImageInput> images, CancellationToken cancellationToken = default)
    {
        if (images.Count == 0) return [];

        var normalized = new List<ProductImageInput>(images.Count);
        foreach (var image in images)
        {
            var url = image.Url?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(url))
            {
                continue;
            }

            if (!TryParseDataUri(url, out var mimeType, out var bytes))
            {
                normalized.Add(new ProductImageInput(url, image.Color));
                continue;
            }

            if (!MimeToExtension.TryGetValue(mimeType, out var extension))
            {
                throw new InvalidOperationException($"Formato de imagen no permitido: {mimeType}");
            }

            var relativePath = await SaveFileAsync(bytes, ProductScope, extension, cancellationToken);
            normalized.Add(new ProductImageInput(relativePath, image.Color));
        }

        return normalized;
    }

    public async Task<string?> NormalizeUrlAsync(string? imageUrl, string scope, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(imageUrl)) return imageUrl;

        var url = imageUrl.Trim();
        if (!TryParseDataUri(url, out var mimeType, out var bytes)) return url;

        if (!MimeToExtension.TryGetValue(mimeType, out var extension))
        {
            throw new InvalidOperationException($"Formato de imagen no permitido: {mimeType}");
        }

        return await SaveFileAsync(bytes, NormalizeScope(scope), extension, cancellationToken);
    }

    public async Task<string> SaveBinaryImageAsync(byte[] bytes, string contentType, string scope, CancellationToken cancellationToken = default)
    {
        if (bytes.Length == 0)
        {
            throw new InvalidOperationException("No se recibio contenido de imagen.");
        }

        if (bytes.Length > MaxImageBytes)
        {
            throw new InvalidOperationException($"La imagen supera el maximo permitido de {MaxImageBytes / (1024 * 1024)} MB.");
        }

        if (!MimeToExtension.TryGetValue(contentType.Trim(), out var extension))
        {
            throw new InvalidOperationException($"Formato de imagen no permitido: {contentType}");
        }

        return await SaveFileAsync(bytes, NormalizeScope(scope), extension, cancellationToken);
    }

    public bool IsManagedPath(string? imageUrl, string? scope = null)
    {
        if (string.IsNullOrWhiteSpace(imageUrl)) return false;
        var normalized = imageUrl.Trim();
        if (!normalized.StartsWith(UploadsPrefix, StringComparison.OrdinalIgnoreCase)) return false;

        if (string.IsNullOrWhiteSpace(scope)) return true;

        var scopedPrefix = $"{UploadsPrefix}{NormalizeScope(scope)}/";
        return normalized.StartsWith(scopedPrefix, StringComparison.OrdinalIgnoreCase);
    }

    public Task DeleteAsync(IEnumerable<string> imageUrls, CancellationToken cancellationToken = default)
    {
        foreach (var imageUrl in imageUrls.Where(url => IsManagedPath(url)))
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                var fullPath = ToFullPath(imageUrl);
                if (File.Exists(fullPath)) File.Delete(fullPath);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "No se pudo eliminar la imagen local {ImageUrl}", imageUrl);
            }
        }

        return Task.CompletedTask;
    }

    private static bool TryParseDataUri(string value, out string mimeType, out byte[] bytes)
    {
        mimeType = string.Empty;
        bytes = [];

        if (!value.StartsWith("data:", StringComparison.OrdinalIgnoreCase)) return false;
        var commaIndex = value.IndexOf(',', StringComparison.Ordinal);
        if (commaIndex <= 5) return false;

        var metadata = value[5..commaIndex];
        if (!metadata.Contains(";base64", StringComparison.OrdinalIgnoreCase)) return false;

        mimeType = metadata.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)[0].ToLowerInvariant();
        var payload = value[(commaIndex + 1)..];
        try
        {
            bytes = Convert.FromBase64String(payload);
            return true;
        }
        catch (FormatException)
        {
            throw new InvalidOperationException("La imagen enviada no tiene un base64 valido.");
        }
    }

    private static async Task<string> SaveFileAsync(byte[] bytes, string scope, string extension, CancellationToken cancellationToken)
    {
        var year = DateTime.UtcNow.Year.ToString(CultureInfo.InvariantCulture);
        var month = DateTime.UtcNow.Month.ToString("00", CultureInfo.InvariantCulture);
        var folder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", scope, year, month);
        Directory.CreateDirectory(folder);

        var fileName = $"{Guid.NewGuid():N}{extension}";
        var fullPath = Path.Combine(folder, fileName);

        await File.WriteAllBytesAsync(fullPath, bytes, cancellationToken);
        return $"{UploadsPrefix}{scope}/{year}/{month}/{fileName}";
    }

    private static string NormalizeScope(string scope)
    {
        var normalized = new string((scope ?? string.Empty).Trim().ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray());
        return string.IsNullOrWhiteSpace(normalized) ? ProductScope : normalized;
    }

    private static string ToFullPath(string imageUrl)
    {
        var relativePath = imageUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
        return Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", relativePath);
    }
}
