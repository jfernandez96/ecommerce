using Ecommerce.Application.Common;
using Ecommerce.Domain.Orders;
using Ecommerce.Domain.Sales;
using FluentValidation;
using MediatR;

namespace Ecommerce.Application.Orders;

public sealed record SearchAdminOrdersQuery(OrderAdminSearchRequest Request) : IRequest<OrderAdminSearchResultDto>;

public sealed class SearchAdminOrdersQueryHandler(IOrderRepository orderRepository)
    : IRequestHandler<SearchAdminOrdersQuery, OrderAdminSearchResultDto>
{
    public async Task<OrderAdminSearchResultDto> Handle(SearchAdminOrdersQuery request, CancellationToken cancellationToken)
    {
        var page = await orderRepository.SearchAdminAsync(request.Request, cancellationToken);
        var summary = await orderRepository.GetAdminSummaryAsync(request.Request, cancellationToken);
        return new OrderAdminSearchResultDto(page, summary);
    }
}

public sealed record GetOrderAdminDetailQuery(Guid Id) : IRequest<OrderAdminDetailDto?>;

public sealed class GetOrderAdminDetailQueryHandler(IOrderRepository orderRepository)
    : IRequestHandler<GetOrderAdminDetailQuery, OrderAdminDetailDto?>
{
    public Task<OrderAdminDetailDto?> Handle(GetOrderAdminDetailQuery request, CancellationToken cancellationToken) =>
        orderRepository.GetAdminDetailAsync(request.Id, cancellationToken);
}

public sealed record CancelOrderCommand(Guid Id, string? Reason) : IRequest<bool>;

public sealed class CancelOrderCommandHandler(
    IOrderRepository orderRepository,
    ISaleRepository saleRepository,
    IStoreSettingsRepository storeSettingsRepository,
    IProductRepository productRepository,
    IInventoryMovementRepository inventoryMovementRepository,
    IUnitOfWork unitOfWork)
    : IRequestHandler<CancelOrderCommand, bool>
{
    public async Task<bool> Handle(CancelOrderCommand request, CancellationToken cancellationToken)
    {
        var order = await orderRepository.GetByIdAsync(request.Id, cancellationToken);
        if (order is null) return false;
        if (order.Status == OrderStatus.Cancelled) return true;

        var loadedProducts = new Dictionary<Guid, Domain.Catalog.Product>();
        var touchedProducts = new HashSet<Domain.Catalog.Product>();

        foreach (var item in order.Items)
        {
            if (!loadedProducts.TryGetValue(item.ProductId, out var product))
            {
                product = await productRepository.GetByIdAsync(item.ProductId, cancellationToken)
                    ?? throw new InvalidOperationException($"No se encontro el producto asociado al item {item.Sku} para devolver stock.");
                loadedProducts[item.ProductId] = product;
            }

            if (item.ProductVariantId.HasValue)
            {
                var variant = product.Variants.FirstOrDefault(current => current.Id == item.ProductVariantId.Value && current.IsActive && !current.IsDeleted);
                if (variant is not null)
                {
                    var stockBefore = variant.Stock;
                    variant.Stock += item.Quantity;
                    await inventoryMovementRepository.AddAsync(new Domain.Catalog.InventoryMovement
                    {
                        StoreId = order.StoreId,
                        ProductId = product.Id,
                        ProductVariantId = variant.Id,
                        MovementType = Domain.Catalog.InventoryMovementType.ReturnFromCancelledOrder,
                        Quantity = item.Quantity,
                        StockBefore = stockBefore,
                        StockAfter = variant.Stock,
                        ReferenceCode = order.Number,
                        Notes = "Reposicion automatica por anulacion de orden."
                    }, cancellationToken);
                    touchedProducts.Add(product);
                    continue;
                }
            }

            var productStockBefore = product.Stock;
            product.Stock += item.Quantity;
            await inventoryMovementRepository.AddAsync(new Domain.Catalog.InventoryMovement
            {
                StoreId = order.StoreId,
                ProductId = product.Id,
                ProductVariantId = null,
                MovementType = Domain.Catalog.InventoryMovementType.ReturnFromCancelledOrder,
                Quantity = item.Quantity,
                StockBefore = productStockBefore,
                StockAfter = product.Stock,
                ReferenceCode = order.Number,
                Notes = "Reposicion automatica por anulacion de orden."
            }, cancellationToken);
            touchedProducts.Add(product);
        }

        foreach (var product in touchedProducts)
        {
            var activeVariants = product.Variants.Where(current => current.IsActive && !current.IsDeleted).ToArray();
            if (activeVariants.Length > 0)
            {
                product.Stock = activeVariants.Sum(current => current.Stock);
            }
        }

        order.Status = OrderStatus.Cancelled;
        if (!string.IsNullOrWhiteSpace(request.Reason))
        {
            order.Notes = string.IsNullOrWhiteSpace(order.Notes)
                ? $"Anulada: {request.Reason.Trim()}"
                : $"{order.Notes}\nAnulada: {request.Reason.Trim()}";
        }

        var latestPayment = order.Payments
            .Where(payment => !payment.IsDeleted)
            .OrderByDescending(payment => payment.CreatedAt)
            .FirstOrDefault();

        if (latestPayment is not null && latestPayment.Status != "confirmed")
        {
            latestPayment.Status = "cancelled";
        }

        await SaleSynchronization.SyncAsync(order, saleRepository, storeSettingsRepository, cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public sealed class CancelOrderCommandValidator : AbstractValidator<CancelOrderCommand>
{
    public CancelOrderCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Reason)
            .MaximumLength(240)
            .WithMessage("El motivo de anulacion no debe superar 240 caracteres.");
    }
}

public sealed record ReactivateOrderCommand(Guid Id, string? Reason) : IRequest<bool>;

public sealed class ReactivateOrderCommandHandler(
    IOrderRepository orderRepository,
    ISaleRepository saleRepository,
    IStoreSettingsRepository storeSettingsRepository,
    IProductRepository productRepository,
    IInventoryMovementRepository inventoryMovementRepository,
    IUnitOfWork unitOfWork)
    : IRequestHandler<ReactivateOrderCommand, bool>
{
    public async Task<bool> Handle(ReactivateOrderCommand request, CancellationToken cancellationToken)
    {
        var order = await orderRepository.GetByIdAsync(request.Id, cancellationToken);
        if (order is null) return false;
        if (order.Status != OrderStatus.Cancelled) return true;

        var loadedProducts = new Dictionary<Guid, Domain.Catalog.Product>();
        var touchedProducts = new HashSet<Domain.Catalog.Product>();

        foreach (var item in order.Items)
        {
            if (!loadedProducts.TryGetValue(item.ProductId, out var product))
            {
                product = await productRepository.GetByIdAsync(item.ProductId, cancellationToken)
                    ?? throw new InvalidOperationException($"No se encontro el producto asociado al item {item.Sku} para reactivar la orden.");
                loadedProducts[item.ProductId] = product;
            }

            if (item.ProductVariantId.HasValue)
            {
                var variant = product.Variants.FirstOrDefault(current => current.Id == item.ProductVariantId.Value && current.IsActive && !current.IsDeleted)
                    ?? throw new InvalidOperationException($"La variante {item.Sku} ya no esta disponible para reactivar la orden.");

                if (variant.Stock < item.Quantity)
                {
                    throw new InvalidOperationException($"Stock insuficiente para reactivar ({variant.Sku}). Disponible: {variant.Stock}.");
                }

                var stockBefore = variant.Stock;
                variant.Stock -= item.Quantity;
                await inventoryMovementRepository.AddAsync(new Domain.Catalog.InventoryMovement
                {
                    StoreId = order.StoreId,
                    ProductId = product.Id,
                    ProductVariantId = variant.Id,
                    MovementType = Domain.Catalog.InventoryMovementType.ManualStockOut,
                    Quantity = item.Quantity,
                    StockBefore = stockBefore,
                    StockAfter = variant.Stock,
                    ReferenceCode = order.Number,
                    Notes = "Reserva de stock por reactivacion de orden anulada."
                }, cancellationToken);

                touchedProducts.Add(product);
                continue;
            }

            if (product.Stock < item.Quantity)
            {
                throw new InvalidOperationException($"Stock insuficiente para reactivar {product.Name}. Disponible: {product.Stock}.");
            }

            var productStockBefore = product.Stock;
            product.Stock -= item.Quantity;
            await inventoryMovementRepository.AddAsync(new Domain.Catalog.InventoryMovement
            {
                StoreId = order.StoreId,
                ProductId = product.Id,
                ProductVariantId = null,
                MovementType = Domain.Catalog.InventoryMovementType.ManualStockOut,
                Quantity = item.Quantity,
                StockBefore = productStockBefore,
                StockAfter = product.Stock,
                ReferenceCode = order.Number,
                Notes = "Reserva de stock por reactivacion de orden anulada."
            }, cancellationToken);
            touchedProducts.Add(product);
        }

        foreach (var product in touchedProducts)
        {
            var activeVariants = product.Variants.Where(current => current.IsActive && !current.IsDeleted).ToArray();
            if (activeVariants.Length > 0)
            {
                product.Stock = activeVariants.Sum(current => current.Stock);
            }
        }

        order.Status = OrderStatus.Pending;
        if (!string.IsNullOrWhiteSpace(request.Reason))
        {
            order.Notes = string.IsNullOrWhiteSpace(order.Notes)
                ? $"Reactivada: {request.Reason.Trim()}"
                : $"{order.Notes}\nReactivada: {request.Reason.Trim()}";
        }

        var latestPayment = order.Payments
            .Where(payment => !payment.IsDeleted)
            .OrderByDescending(payment => payment.CreatedAt)
            .FirstOrDefault();

        if (latestPayment is not null && latestPayment.Status == "cancelled")
        {
            latestPayment.Status = "pending_contact";
        }

        await SaleSynchronization.SyncAsync(order, saleRepository, storeSettingsRepository, cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public sealed class ReactivateOrderCommandValidator : AbstractValidator<ReactivateOrderCommand>
{
    public ReactivateOrderCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Reason)
            .MaximumLength(240)
            .WithMessage("El motivo de reactivacion no debe superar 240 caracteres.");
    }
}

public sealed record UpdateOrderPaymentStatusCommand(Guid Id, string PaymentStatus) : IRequest<bool>;

public sealed class UpdateOrderPaymentStatusCommandHandler(IOrderRepository orderRepository, ISaleRepository saleRepository, IStoreSettingsRepository storeSettingsRepository, IUnitOfWork unitOfWork)
    : IRequestHandler<UpdateOrderPaymentStatusCommand, bool>
{
    public async Task<bool> Handle(UpdateOrderPaymentStatusCommand request, CancellationToken cancellationToken)
    {
        var order = await orderRepository.GetByIdAsync(request.Id, cancellationToken);
        if (order is null) return false;

        var latestPayment = order.Payments
            .Where(payment => !payment.IsDeleted)
            .OrderByDescending(payment => payment.CreatedAt)
            .FirstOrDefault();

        if (latestPayment is null)
        {
            throw new InvalidOperationException("La orden no tiene un pago asociado para actualizar.");
        }

        var normalizedStatus = request.PaymentStatus.Trim().ToLowerInvariant();
        latestPayment.Status = normalizedStatus;

        if (normalizedStatus == "confirmed" && order.Status != OrderStatus.Cancelled)
        {
            order.Status = OrderStatus.Paid;
        }
        else if (normalizedStatus == "rejected" && order.Status == OrderStatus.Paid)
        {
            order.Status = OrderStatus.Pending;
        }

        await SaleSynchronization.SyncAsync(order, saleRepository, storeSettingsRepository, cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public sealed class UpdateOrderPaymentStatusCommandValidator : AbstractValidator<UpdateOrderPaymentStatusCommand>
{
    public UpdateOrderPaymentStatusCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.PaymentStatus)
            .Must(value => value is "pending" or "pending_contact" or "confirmed" or "rejected")
            .WithMessage("El estado de pago debe ser pending, pending_contact, confirmed o rejected.");
    }
}

public sealed record SendOrderWhatsAppCommand(Guid Id, string MessageType) : IRequest<Unit>;

public sealed class SendOrderWhatsAppCommandHandler(IOrderRepository orderRepository, IWhatsAppNotificationService whatsAppNotificationService)
    : IRequestHandler<SendOrderWhatsAppCommand, Unit>
{
    public async Task<Unit> Handle(SendOrderWhatsAppCommand request, CancellationToken cancellationToken)
    {
        var order = await orderRepository.GetByIdAsync(request.Id, cancellationToken)
            ?? throw new InvalidOperationException("La orden no existe.");

        await whatsAppNotificationService.SendOrderDecisionMessageAsync(order, request.MessageType.Trim().ToLowerInvariant(), cancellationToken);
        return Unit.Value;
    }
}

public sealed class SendOrderWhatsAppCommandValidator : AbstractValidator<SendOrderWhatsAppCommand>
{
    public SendOrderWhatsAppCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.MessageType)
            .Must(value => value is "confirm" or "reject")
            .WithMessage("El tipo de mensaje de WhatsApp debe ser confirm o reject.");
    }
}

internal static class SaleSynchronization
{
    public static async Task SyncAsync(Order order, ISaleRepository saleRepository, IStoreSettingsRepository storeSettingsRepository, CancellationToken cancellationToken)
    {
        var latestPayment = order.Payments
            .Where(payment => !payment.IsDeleted)
            .OrderByDescending(payment => payment.CreatedAt)
            .FirstOrDefault();

        var existingSale = await saleRepository.GetByOrderIdAsync(order.Id, cancellationToken);
        if (latestPayment is null && existingSale is null) return;

        if (latestPayment is not null && latestPayment.Status != "confirmed" && existingSale is null && order.Status is not OrderStatus.Cancelled and not OrderStatus.Returned)
        {
            return;
        }

        var sale = existingSale ?? new Sale();
        sale.OrderId = order.Id;
        sale.OrderNumber = order.Number;
        sale.StoreId = order.StoreId;
        sale.StoreName = order.StoreName;
        sale.CustomerId = order.CustomerId;
        sale.CustomerName = order.ShippingAddress.FullName;
        sale.CustomerEmail = order.CustomerEmail;
        sale.CustomerPhone = order.ShippingAddress.Phone;
        sale.DocumentNumber = order.DocumentNumber;
        sale.CustomerDocumentType = order.CustomerDocumentType;
        sale.DocumentType = order.DocumentType;
        sale.Subtotal = order.Subtotal;
        sale.Discount = order.Discount;
        sale.Tax = order.Tax;
        sale.TaxType = order.TaxType;
        sale.TaxRate = order.TaxRate;
        sale.TaxIncludedInPrice = order.TaxIncludedInPrice;
        sale.Total = order.Total;
        sale.PaymentMethod = order.PaymentMethod;
        sale.PaymentStatus = MapPaymentStatus(latestPayment?.Status);
        sale.SaleStatus = MapSaleStatus(order.Status, sale.PaymentStatus);
        sale.PaymentReference = latestPayment?.ExternalReference;
        sale.Observations = order.Notes;
        sale.DeliveryType = order.FulfillmentType == OrderFulfillmentType.StorePickup
            ? SaleDeliveryType.Pickup
            : SaleDeliveryType.Shipping;
        sale.DepartmentName = order.ShippingAddress.Department;
        sale.ProvinceName = order.ShippingAddress.Province;
        sale.DistrictName = order.ShippingAddress.District;
        sale.Address = order.ShippingAddress.Line1;
        sale.Reference = order.ShippingAddress.Reference;
        sale.ShippingCost = order.Shipping;
        sale.SourceChannel = SaleChannel.Ecommerce;
        sale.SaleDate = latestPayment is not null
            ? latestPayment.UpdatedAt ?? latestPayment.CreatedAt
            : existingSale?.SaleDate ?? order.CreatedAt;

        if (string.IsNullOrWhiteSpace(sale.SunatSeries) || !sale.SunatCorrelative.HasValue)
        {
            var settings = await storeSettingsRepository.GetOrCreateAsync(cancellationToken);
            AssignSunatNumbering(sale, settings);
        }

        sale.Items.Clear();
        var items = order.Items.Where(current => !current.IsDeleted).ToArray();

        foreach (var item in items)
        {
            sale.Items.Add(new SaleItem
            {
                SaleId = sale.Id,
                ProductId = item.ProductId,
                ProductVariantId = item.ProductVariantId,
                ProductName = item.ProductName,
                Sku = item.Sku,
                VariantDescription = !string.IsNullOrWhiteSpace(item.Color) && !string.IsNullOrWhiteSpace(item.Size)
                    ? $"{item.Color} / {item.Size}"
                    : item.Color ?? item.Size,
                Quantity = item.Quantity,
                Price = item.UnitPrice,
                UnitPriceWithoutTax = item.UnitPriceWithoutTax,
                UnitPriceWithTax = item.UnitPriceWithTax,
                TaxType = item.TaxType,
                TaxRate = item.TaxRate,
                TaxIncludedInPrice = item.TaxIncludedInPrice,
                TaxAffectationCode = item.TaxAffectationCode,
                TaxSchemeId = item.TaxSchemeId,
                TaxSchemeName = item.TaxSchemeName,
                TaxTypeCode = item.TaxTypeCode,
                TaxableAmount = item.TaxableAmount,
                TaxAmount = item.TaxAmount,
                LineAmountWithoutTax = item.LineAmountWithoutTax,
                LineAmountWithTax = item.LineAmountWithTax,
                Discount = 0m,
                Subtotal = item.LineAmountWithoutTax,
                Tax = item.TaxAmount,
                Total = item.LineAmountWithTax
            });
        }

        if (existingSale is null)
        {
            await saleRepository.AddAsync(sale, cancellationToken);
        }
    }

    private static SalePaymentStatus MapPaymentStatus(string? value) => value switch
    {
        "confirmed" => SalePaymentStatus.Confirmed,
        "rejected" => SalePaymentStatus.Rejected,
        "cancelled" => SalePaymentStatus.Cancelled,
        _ => SalePaymentStatus.Pending
    };

    private static SaleStatus MapSaleStatus(OrderStatus orderStatus, SalePaymentStatus paymentStatus)
    {
        if (orderStatus == OrderStatus.Cancelled || paymentStatus == SalePaymentStatus.Cancelled || paymentStatus == SalePaymentStatus.Rejected)
        {
            return SaleStatus.Cancelled;
        }

        if (orderStatus == OrderStatus.Returned)
        {
            return SaleStatus.Returned;
        }

        if (orderStatus is OrderStatus.Preparing or OrderStatus.Shipped or OrderStatus.Delivered)
        {
            return SaleStatus.InFulfillment;
        }

        return paymentStatus == SalePaymentStatus.Confirmed ? SaleStatus.Confirmed : SaleStatus.PendingPayment;
    }

    private static void AssignSunatNumbering(Sale sale, Domain.Common.StoreSettings settings)
    {
        if (sale.DocumentType == DocumentType.Invoice)
        {
            var nextInvoice = settings.SunatInvoiceNextCorrelative > 0 ? settings.SunatInvoiceNextCorrelative : 1;
            sale.SunatSeries = string.IsNullOrWhiteSpace(settings.SunatInvoiceSeries) ? "F001" : settings.SunatInvoiceSeries.Trim().ToUpperInvariant();
            sale.SunatCorrelative = nextInvoice;
            settings.SunatInvoiceNextCorrelative = nextInvoice + 1;
            return;
        }

        var nextReceipt = settings.SunatReceiptNextCorrelative > 0 ? settings.SunatReceiptNextCorrelative : 1;
        sale.SunatSeries = string.IsNullOrWhiteSpace(settings.SunatReceiptSeries) ? "B001" : settings.SunatReceiptSeries.Trim().ToUpperInvariant();
        sale.SunatCorrelative = nextReceipt;
        settings.SunatReceiptNextCorrelative = nextReceipt + 1;
    }
}