using Ecommerce.Application.Common;
using Ecommerce.Domain.Customers;
using Ecommerce.Domain.Catalog;
using FluentValidation;
using MediatR;

namespace Ecommerce.Application.Customers;

public sealed record AddToWishlistCommand(string Email, Guid ProductId) : IRequest<AddToWishlistResultDto>;

public sealed class AddToWishlistCommandValidator : AbstractValidator<AddToWishlistCommand>
{
    public AddToWishlistCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.ProductId).NotEmpty();
    }
}

public sealed class AddToWishlistCommandHandler(
    IWishlistRepository wishlistRepository,
    IProductRepository productRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<AddToWishlistCommand, AddToWishlistResultDto>
{
    public async Task<AddToWishlistResultDto> Handle(AddToWishlistCommand request, CancellationToken cancellationToken)
    {
        var product = await productRepository.GetByIdAsync(request.ProductId, cancellationToken)
            ?? throw new InvalidOperationException("El producto no existe.");

        var wishlist = await wishlistRepository.GetByEmailAsync(request.Email, cancellationToken);

        if (wishlist is null)
        {
            wishlist = new Wishlist { CustomerEmail = request.Email };
            wishlist.Items.Add(new WishlistItem { ProductId = request.ProductId });
            await wishlistRepository.AddAsync(wishlist, cancellationToken);
        }
        else
        {
            var exists = await wishlistRepository.IsProductInWishlistAsync(wishlist.Id, request.ProductId, cancellationToken);
            if (exists)
            {
                return new AddToWishlistResultDto(false, "El producto ya está en favoritos.");
            }

            wishlist.Items.Add(new WishlistItem { ProductId = request.ProductId });
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return new AddToWishlistResultDto(true, "Producto agregado a favoritos.");
    }
}

public sealed record RemoveFromWishlistCommand(string Email, Guid ProductId) : IRequest<RemoveFromWishlistResultDto>;

public sealed class RemoveFromWishlistCommandHandler(
    IWishlistRepository wishlistRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<RemoveFromWishlistCommand, RemoveFromWishlistResultDto>
{
    public async Task<RemoveFromWishlistResultDto> Handle(RemoveFromWishlistCommand request, CancellationToken cancellationToken)
    {
        var wishlist = await wishlistRepository.GetByEmailAsync(request.Email, cancellationToken);
        
        if (wishlist is null)
        {
            return new RemoveFromWishlistResultDto(false, "Lista de favoritos no encontrada.");
        }

        var item = wishlist.Items.FirstOrDefault(x => x.ProductId == request.ProductId);
        if (item is null)
        {
            return new RemoveFromWishlistResultDto(false, "El producto no está en favoritos.");
        }

        wishlist.Items.Remove(item);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return new RemoveFromWishlistResultDto(true, "Producto removido de favoritos.");
    }
}

public sealed record GetWishlistQuery(string Email) : IRequest<WishlistDto>;

public sealed class GetWishlistQueryHandler(IWishlistRepository wishlistRepository) : IRequestHandler<GetWishlistQuery, WishlistDto>
{
    public async Task<WishlistDto> Handle(GetWishlistQuery request, CancellationToken cancellationToken)
    {
        var wishlist = await wishlistRepository.GetByEmailAsync(request.Email, cancellationToken);
        
        if (wishlist is null)
        {
            return new WishlistDto(Guid.Empty, request.Email, []);
        }

        var items = wishlist.Items.Select(x => new WishlistItemDto(
            x.ProductId,
            x.Product?.Name ?? "Producto",
            x.Product?.Slug ?? "",
            x.Product?.Images.FirstOrDefault()?.Url ?? "",
            x.Product?.RegularPrice ?? 0,
            x.Product?.SalePrice,
            x.Product?.Brand?.Name ?? ""
        )).ToList();

        return new WishlistDto(wishlist.Id, wishlist.CustomerEmail, items);
    }
}
