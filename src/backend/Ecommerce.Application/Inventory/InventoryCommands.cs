using Ecommerce.Application.Common;
using Ecommerce.Domain.Catalog;
using FluentValidation;
using MediatR;

namespace Ecommerce.Application.Inventory;

public sealed record RegisterStockInCommand(
    Guid StoreId,
    Guid ProductId,
    Guid? ProductVariantId,
    int Quantity,
    string? SupplierName,
    string? ReferenceCode,
    string? Notes) : IRequest<InventoryMovementDto>;

public sealed class RegisterStockInCommandValidator : AbstractValidator<RegisterStockInCommand>
{
    public RegisterStockInCommandValidator()
    {
        RuleFor(x => x.ProductId).NotEmpty();
        RuleFor(x => x.StoreId).NotEmpty();
        RuleFor(x => x.Quantity).GreaterThan(0);
        RuleFor(x => x.SupplierName).MaximumLength(180);
        RuleFor(x => x.ReferenceCode).MaximumLength(100);
        RuleFor(x => x.Notes).MaximumLength(500);
    }
}

public sealed class RegisterStockInCommandHandler(
    IProductRepository productRepository,
    IStoreLocationRepository storeLocationRepository,
    IInventoryMovementRepository inventoryMovementRepository,
    IUnitOfWork unitOfWork)
    : IRequestHandler<RegisterStockInCommand, InventoryMovementDto>
{
    public async Task<InventoryMovementDto> Handle(RegisterStockInCommand request, CancellationToken cancellationToken)
    {
        var product = await productRepository.GetByIdAsync(request.ProductId, cancellationToken)
            ?? throw new InvalidOperationException("El producto no existe.");
        var store = await storeLocationRepository.GetByIdAsync(request.StoreId, cancellationToken)
            ?? throw new InvalidOperationException("La tienda seleccionada no existe.");

        if (!store.IsActive)
        {
            throw new InvalidOperationException("La tienda seleccionada no esta activa para movimientos.");
        }

        var storeStock = await storeLocationRepository.GetOrCreateProductStockAsync(store.Id, product.Id, cancellationToken);
        var hasActiveVariants = product.Variants.Any(current => current.IsActive && !current.IsDeleted);

        if (hasActiveVariants && !request.ProductVariantId.HasValue)
        {
            throw new InvalidOperationException("Este producto trabaja stock por talla/color. Selecciona una variante para registrar el ingreso.");
        }

        ProductVariant? variant = null;
        var variantLabel = (string?)null;
        var productSku = product.Sku;
        var stockBefore = product.Stock;
        var stockAfter = product.Stock;

        if (request.ProductVariantId.HasValue)
        {
            variant = product.Variants.FirstOrDefault(current => current.Id == request.ProductVariantId.Value && current.IsActive && !current.IsDeleted)
                ?? throw new InvalidOperationException("La variante seleccionada no esta disponible para ingreso.");

            stockBefore = variant.Stock;
            variant.Stock += request.Quantity;
            stockAfter = variant.Stock;
            variantLabel = $"{variant.Color} / {variant.Size}";
            productSku = variant.Sku;
        }
        else
        {
            product.Stock += request.Quantity;
            stockAfter = product.Stock;
        }

        storeStock.Stock += request.Quantity;

        var activeVariants = product.Variants.Where(current => current.IsActive && !current.IsDeleted).ToArray();
        if (activeVariants.Length > 0)
        {
            product.Stock = activeVariants.Sum(current => current.Stock);
        }

        var movement = new InventoryMovement
        {
            StoreId = request.StoreId,
            ProductId = product.Id,
            ProductVariantId = variant?.Id,
            MovementType = InventoryMovementType.StockIn,
            Quantity = request.Quantity,
            StockBefore = stockBefore,
            StockAfter = stockAfter,
            SupplierName = string.IsNullOrWhiteSpace(request.SupplierName) ? null : request.SupplierName.Trim(),
            ReferenceCode = string.IsNullOrWhiteSpace(request.ReferenceCode) ? null : request.ReferenceCode.Trim(),
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
        };

        await inventoryMovementRepository.AddAsync(movement, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new InventoryMovementDto(
            movement.Id,
            movement.StoreId,
            store.Name,
            movement.ProductId,
            movement.ProductVariantId,
            product.Name,
            productSku,
            variantLabel,
            (int)movement.MovementType,
            movement.Quantity,
            movement.StockBefore,
            movement.StockAfter,
            movement.SupplierName,
            movement.ReferenceCode,
            movement.Notes,
            movement.CreatedAt);
    }
}

public sealed record RegisterStockOutCommand(
    Guid StoreId,
    Guid ProductId,
    Guid? ProductVariantId,
    int Quantity,
    string? ReferenceCode,
    string? Notes) : IRequest<InventoryMovementDto>;

public sealed class RegisterStockOutCommandValidator : AbstractValidator<RegisterStockOutCommand>
{
    public RegisterStockOutCommandValidator()
    {
        RuleFor(x => x.ProductId).NotEmpty();
        RuleFor(x => x.StoreId).NotEmpty();
        RuleFor(x => x.Quantity).GreaterThan(0);
        RuleFor(x => x.ReferenceCode).MaximumLength(100);
        RuleFor(x => x.Notes)
            .NotEmpty()
            .WithMessage("Debes registrar una razon de salida para mantener trazabilidad.")
            .MaximumLength(500);
    }
}

public sealed class RegisterStockOutCommandHandler(
    IProductRepository productRepository,
    IStoreLocationRepository storeLocationRepository,
    IInventoryMovementRepository inventoryMovementRepository,
    IUnitOfWork unitOfWork)
    : IRequestHandler<RegisterStockOutCommand, InventoryMovementDto>
{
    public async Task<InventoryMovementDto> Handle(RegisterStockOutCommand request, CancellationToken cancellationToken)
    {
        var normalizedNotes = request.Notes?.Trim();
        if (string.IsNullOrWhiteSpace(normalizedNotes))
        {
            throw new InvalidOperationException("Debes registrar una razon de salida para mantener trazabilidad.");
        }

        var product = await productRepository.GetByIdAsync(request.ProductId, cancellationToken)
            ?? throw new InvalidOperationException("El producto no existe.");
        var store = await storeLocationRepository.GetByIdAsync(request.StoreId, cancellationToken)
            ?? throw new InvalidOperationException("La tienda seleccionada no existe.");

        if (!store.IsActive)
        {
            throw new InvalidOperationException("La tienda seleccionada no esta activa para movimientos.");
        }

        var storeStock = await storeLocationRepository.GetOrCreateProductStockAsync(store.Id, product.Id, cancellationToken);
        if (storeStock.Stock < request.Quantity)
        {
            throw new InvalidOperationException($"Stock insuficiente en tienda {store.Name}. Disponible: {storeStock.Stock}.");
        }
        var hasActiveVariants = product.Variants.Any(current => current.IsActive && !current.IsDeleted);

        if (hasActiveVariants && !request.ProductVariantId.HasValue)
        {
            throw new InvalidOperationException("Este producto trabaja stock por talla/color. Selecciona una variante para registrar la salida.");
        }

        ProductVariant? variant = null;
        var variantLabel = (string?)null;
        var productSku = product.Sku;
        var stockBefore = product.Stock;
        var stockAfter = product.Stock;

        if (request.ProductVariantId.HasValue)
        {
            variant = product.Variants.FirstOrDefault(current => current.Id == request.ProductVariantId.Value && current.IsActive && !current.IsDeleted)
                ?? throw new InvalidOperationException("La variante seleccionada no esta disponible para salida.");

            if (variant.Stock < request.Quantity)
            {
                throw new InvalidOperationException($"Stock insuficiente en variante {variant.Color} / {variant.Size}. Disponible: {variant.Stock}.");
            }

            stockBefore = variant.Stock;
            variant.Stock -= request.Quantity;
            stockAfter = variant.Stock;
            variantLabel = $"{variant.Color} / {variant.Size}";
            productSku = variant.Sku;
        }
        else
        {
            if (product.Stock < request.Quantity)
            {
                throw new InvalidOperationException($"Stock insuficiente para {product.Name}. Disponible: {product.Stock}.");
            }

            product.Stock -= request.Quantity;
            stockAfter = product.Stock;
        }

        storeStock.Stock -= request.Quantity;

        var activeVariants = product.Variants.Where(current => current.IsActive && !current.IsDeleted).ToArray();
        if (activeVariants.Length > 0)
        {
            product.Stock = activeVariants.Sum(current => current.Stock);
        }

        var movement = new InventoryMovement
        {
            StoreId = request.StoreId,
            ProductId = product.Id,
            ProductVariantId = variant?.Id,
            MovementType = InventoryMovementType.ManualStockOut,
            Quantity = request.Quantity,
            StockBefore = stockBefore,
            StockAfter = stockAfter,
            ReferenceCode = string.IsNullOrWhiteSpace(request.ReferenceCode) ? null : request.ReferenceCode.Trim(),
            Notes = normalizedNotes,
        };

        await inventoryMovementRepository.AddAsync(movement, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new InventoryMovementDto(
            movement.Id,
            movement.StoreId,
            store.Name,
            movement.ProductId,
            movement.ProductVariantId,
            product.Name,
            productSku,
            variantLabel,
            (int)movement.MovementType,
            movement.Quantity,
            movement.StockBefore,
            movement.StockAfter,
            movement.SupplierName,
            movement.ReferenceCode,
            movement.Notes,
            movement.CreatedAt);
    }
}

public sealed record SearchInventoryMovementsQuery(InventoryMovementSearchRequest Request) : IRequest<PagedResult<InventoryMovementDto>>;

public sealed class SearchInventoryMovementsQueryHandler(IInventoryMovementRepository inventoryMovementRepository)
    : IRequestHandler<SearchInventoryMovementsQuery, PagedResult<InventoryMovementDto>>
{
    public Task<PagedResult<InventoryMovementDto>> Handle(SearchInventoryMovementsQuery request, CancellationToken cancellationToken) =>
        inventoryMovementRepository.SearchAsync(request.Request, cancellationToken);
}

public sealed record GetLowStockAlertsQuery(int Top = 30) : IRequest<IReadOnlyList<LowStockAlertDto>>;

public sealed class GetLowStockAlertsQueryHandler(IProductRepository productRepository)
    : IRequestHandler<GetLowStockAlertsQuery, IReadOnlyList<LowStockAlertDto>>
{
    public Task<IReadOnlyList<LowStockAlertDto>> Handle(GetLowStockAlertsQuery request, CancellationToken cancellationToken) =>
        productRepository.GetLowStockAlertsAsync(request.Top, cancellationToken);
}
