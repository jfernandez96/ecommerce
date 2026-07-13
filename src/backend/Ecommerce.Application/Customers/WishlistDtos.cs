namespace Ecommerce.Application.Customers;

public sealed record WishlistItemDto(Guid ProductId, string ProductName, string ProductSlug, string ProductImage, decimal RegularPrice, decimal? SalePrice, string Brand);

public sealed record WishlistDto(Guid Id, string Email, List<WishlistItemDto> Items);

public sealed record AddToWishlistResultDto(bool IsAdded, string Message);

public sealed record RemoveFromWishlistResultDto(bool IsRemoved, string Message);
