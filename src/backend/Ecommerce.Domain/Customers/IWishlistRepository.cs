namespace Ecommerce.Domain.Customers;

public interface IWishlistRepository
{
    Task<Wishlist?> GetByEmailAsync(string email, CancellationToken cancellationToken = default);
    Task<Wishlist?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<bool> IsProductInWishlistAsync(Guid wishlistId, Guid productId, CancellationToken cancellationToken = default);
    Task AddAsync(Wishlist wishlist, CancellationToken cancellationToken = default);
}
