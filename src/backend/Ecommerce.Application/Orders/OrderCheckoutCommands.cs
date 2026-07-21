using Ecommerce.Application.Common;
using Ecommerce.Application.Promotions;
using Ecommerce.Domain.Catalog;
using Ecommerce.Domain.Orders;
using FluentValidation;
using MediatR;
using System.Security.Cryptography;

namespace Ecommerce.Application.Orders;

public sealed record CheckoutItemInput(Guid ProductId, Guid? ProductVariantId, int Quantity);

public sealed record CreateOrderCommand(
    string Email,
    string FullName,
    string Phone,
    string Line1,
    string District,
    string Province,
    string Department,
    string? Reference,
    string DocumentType,
    string CustomerDocumentType,
    string DocumentNumber,
    string PaymentMethod,
    string FulfillmentType,
    Guid StoreId,
    string? Notes,
    string? CouponCode,
    IReadOnlyList<CheckoutItemInput> Items) : IRequest<OrderCheckoutResultDto>;

public sealed class CreateOrderCommandValidator : AbstractValidator<CreateOrderCommand>
{
    public CreateOrderCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(180);
        RuleFor(x => x.Phone).NotEmpty().MaximumLength(30);
        RuleFor(x => x.Line1).MaximumLength(240);
        RuleFor(x => x.District).MaximumLength(160);
        RuleFor(x => x.Province).MaximumLength(140);
        RuleFor(x => x.Department).MaximumLength(120);
        RuleFor(x => x)
            .Must(x => x.FulfillmentType != "shipping" ||
                (!string.IsNullOrWhiteSpace(x.Line1)
                 && !string.IsNullOrWhiteSpace(x.District)
                 && !string.IsNullOrWhiteSpace(x.Province)
                 && !string.IsNullOrWhiteSpace(x.Department)))
            .WithMessage("Para envio debes completar direccion, distrito, provincia y departamento.");
        RuleFor(x => x.DocumentNumber).NotEmpty().MaximumLength(20);
        RuleFor(x => x.DocumentType).Must(value => value is "receipt" or "invoice")
            .WithMessage("El tipo de comprobante debe ser receipt o invoice.");
        RuleFor(x => x.CustomerDocumentType).Must(value => value is "dni" or "ruc" or "ce" or "passport")
            .WithMessage("El tipo de documento del cliente debe ser dni, ruc, ce o passport.");
        RuleFor(x => x)
            .Must(request => request.DocumentType != "invoice" || request.CustomerDocumentType == "ruc")
            .WithMessage("Para factura el tipo de documento del cliente debe ser RUC.");
        RuleFor(x => x.DocumentNumber)
            .Must((request, value) => IsDocumentNumberValid(request.CustomerDocumentType, value))
            .WithMessage("El numero de documento no coincide con el tipo de documento del cliente.");
        RuleFor(x => x.PaymentMethod).Must(value => value is "card" or "yape")
            .WithMessage("El metodo de pago debe ser card o yape.");
        RuleFor(x => x.FulfillmentType).Must(value => value is "shipping" or "pickup")
            .WithMessage("El tipo de entrega debe ser shipping o pickup.");
        RuleFor(x => x.StoreId).NotEmpty();
        RuleFor(x => x.CouponCode).MaximumLength(80);
        RuleFor(x => x.Items).NotEmpty();
        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(x => x.ProductId).NotEmpty();
            item.RuleFor(x => x.Quantity).GreaterThan(0);
        });
    }

    private static bool IsDocumentNumberValid(string customerDocumentType, string documentNumber)
    {
        var sanitized = documentNumber.Trim();
        return customerDocumentType switch
        {
            "dni" => sanitized.Length == 8 && sanitized.All(char.IsDigit),
            "ruc" => sanitized.Length == 11 && sanitized.All(char.IsDigit),
            "ce" => sanitized.Length is >= 6 and <= 20,
            "passport" => sanitized.Length is >= 6 and <= 20,
            _ => false
        };
    }
}

public sealed class CreateOrderCommandHandler(
    IOrderRepository orderRepository,
    IProductRepository productRepository,
    IStoreLocationRepository storeLocationRepository,
    IPromotionRepository promotionRepository,
    IStoreSettingsRepository storeSettingsRepository,
    IPaymentPreparationService paymentPreparationService,
    IOrderNotificationService orderNotificationService,
    IUnitOfWork unitOfWork) : IRequestHandler<CreateOrderCommand, OrderCheckoutResultDto>
{
    private static readonly char[] OrderCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".ToCharArray();

    public async Task<OrderCheckoutResultDto> Handle(CreateOrderCommand request, CancellationToken cancellationToken)
    {
        var settings = await storeSettingsRepository.GetOrCreateAsync(cancellationToken);
        var activeTaxType = string.Equals(settings.ActiveTaxType, "IVA", StringComparison.OrdinalIgnoreCase) ? "IVA" : "IGV";
        var configuredRate = activeTaxType == "IVA" ? settings.IvaRate : settings.IgvRate;
        var taxRate = configuredRate < 0 ? 0 : configuredRate;
        var taxIncludedInPrice = settings.TaxIncludedInPrice;
        var (taxSchemeId, taxSchemeName, taxTypeCode, taxAffectationCode) = ResolveTaxScheme(activeTaxType);

        var store = await storeLocationRepository.GetByIdAsync(request.StoreId, cancellationToken)
            ?? throw new InvalidOperationException("La tienda seleccionada no existe.");

        if (!store.IsActive)
        {
            throw new InvalidOperationException("La tienda seleccionada no esta disponible actualmente.");
        }

        var fulfillmentType = request.FulfillmentType == "pickup"
            ? OrderFulfillmentType.StorePickup
            : OrderFulfillmentType.Shipping;

        var paymentMethod = settings.PaymentGatewayEnabled && request.PaymentMethod == "yape"
            ? PaymentMethod.Yape
            : PaymentMethod.Stripe;
        var documentType = request.DocumentType == "invoice" ? DocumentType.Invoice : DocumentType.Receipt;
        var customerDocumentType = request.CustomerDocumentType switch
        {
            "dni" => CustomerDocumentType.Dni,
            "ruc" => CustomerDocumentType.Ruc,
            "ce" => CustomerDocumentType.ForeignerCard,
            "passport" => CustomerDocumentType.Passport,
            _ => CustomerDocumentType.Dni
        };

        var order = new Order
        {
            Number = GenerateOrderNumber(),
            StoreId = store.Id,
            StoreName = store.Name,
            FulfillmentType = fulfillmentType,
            CustomerEmail = request.Email.Trim(),
            DocumentNumber = request.DocumentNumber.Trim(),
            DocumentType = documentType,
            CustomerDocumentType = customerDocumentType,
            PaymentMethod = paymentMethod,
            Status = OrderStatus.Pending,
            Notes = request.Notes?.Trim() ?? string.Empty,
            ShippingAddress = new Address
            {
                FullName = request.FullName.Trim(),
                Phone = request.Phone.Trim(),
                Line1 = fulfillmentType == OrderFulfillmentType.StorePickup
                    ? (string.IsNullOrWhiteSpace(request.Line1) ? store.Address : request.Line1.Trim())
                    : request.Line1.Trim(),
                District = fulfillmentType == OrderFulfillmentType.StorePickup
                    ? (string.IsNullOrWhiteSpace(request.District) ? (store.District ?? string.Empty) : request.District.Trim())
                    : request.District.Trim(),
                Province = fulfillmentType == OrderFulfillmentType.StorePickup
                    ? (string.IsNullOrWhiteSpace(request.Province) ? (store.Province ?? string.Empty) : request.Province.Trim())
                    : request.Province.Trim(),
                Department = fulfillmentType == OrderFulfillmentType.StorePickup
                    ? (string.IsNullOrWhiteSpace(request.Department) ? (store.Department ?? string.Empty) : request.Department.Trim())
                    : request.Department.Trim(),
                Reference = request.Reference?.Trim() ?? string.Empty
            }
        };

        var loadedProducts = new Dictionary<Guid, Product>();
        var touchedProducts = new HashSet<Product>();
        var promotionLines = new List<PromotionCartLine>(request.Items.Count);

        foreach (var item in request.Items)
        {
            if (!loadedProducts.TryGetValue(item.ProductId, out var product))
            {
                product = await productRepository.GetByIdAsync(item.ProductId, cancellationToken)
                    ?? throw new InvalidOperationException("Uno de los productos enviados no existe.");
                loadedProducts[item.ProductId] = product;
            }

            var productStoreStock = await storeLocationRepository.GetOrCreateProductStockAsync(store.Id, product.Id, cancellationToken);
            if (productStoreStock.Stock <= 0 && product.MainStoreId == store.Id && product.Stock > 0)
            {
                var distributedStock = await storeLocationRepository.GetProductStocksAsync(product.Id, cancellationToken);
                if (distributedStock.Sum(entry => entry.Stock) <= 0)
                {
                    productStoreStock.Stock = product.Stock;
                }
            }

            if (productStoreStock.Stock < item.Quantity)
            {
                throw new InvalidOperationException($"Stock insuficiente en tienda {store.Name} para {product.Name}. Disponible: {productStoreStock.Stock}.");
            }

            productStoreStock.Stock -= item.Quantity;

            if (product.Status != ProductStatus.Active)
            {
                throw new InvalidOperationException($"El producto {product.Name} no esta disponible.");
            }

            var variant = item.ProductVariantId.HasValue
                ? product.Variants.FirstOrDefault(current => current.Id == item.ProductVariantId.Value && current.IsActive && !current.IsDeleted)
                : null;

            if (item.ProductVariantId.HasValue && variant is null)
            {
                throw new InvalidOperationException($"La variante seleccionada para {product.Name} ya no esta disponible.");
            }

            if (variant is not null)
            {
                if (variant.Stock < item.Quantity)
                {
                    throw new InvalidOperationException($"Stock insuficiente para {product.Name} ({variant.Color} {variant.Size}). Disponible: {variant.Stock}.");
                }

                variant.Stock -= item.Quantity;
            }
            else
            {
                if (product.Stock < item.Quantity)
                {
                    throw new InvalidOperationException($"Stock insuficiente para {product.Name}. Disponible: {product.Stock}.");
                }

                product.Stock -= item.Quantity;
            }

            touchedProducts.Add(product);

            var unitPrice = product.EffectivePrice + (variant?.PriceAdjustment ?? 0m);
            promotionLines.Add(new PromotionCartLine(product.Id, product.CategoryId, product.BrandId, item.Quantity, unitPrice));
            var unitPriceWithoutTax = taxIncludedInPrice
                ? SafeRound(unitPrice / (1m + (taxRate / 100m)))
                : SafeRound(unitPrice);
            var unitPriceWithTax = taxIncludedInPrice
                ? SafeRound(unitPrice)
                : SafeRound(unitPriceWithoutTax * (1m + (taxRate / 100m)));
            var lineAmountWithoutTax = SafeRound(unitPriceWithoutTax * item.Quantity);
            var lineAmountWithTax = SafeRound(unitPriceWithTax * item.Quantity);
            var lineTax = SafeRound(lineAmountWithTax - lineAmountWithoutTax);

            order.Items.Add(new OrderItem
            {
                OrderId = order.Id,
                ProductId = product.Id,
                ProductVariantId = variant?.Id,
                ProductName = product.Name,
                Sku = variant?.Sku ?? product.Sku,
                Color = variant?.Color,
                Size = variant?.Size,
                UnitPrice = unitPrice,
                UnitPriceWithoutTax = unitPriceWithoutTax,
                UnitPriceWithTax = unitPriceWithTax,
                Quantity = item.Quantity,
                TaxType = activeTaxType,
                TaxRate = taxRate,
                TaxIncludedInPrice = taxIncludedInPrice,
                TaxAffectationCode = taxAffectationCode,
                TaxSchemeId = taxSchemeId,
                TaxSchemeName = taxSchemeName,
                TaxTypeCode = taxTypeCode,
                TaxableAmount = lineAmountWithoutTax,
                TaxAmount = lineTax,
                LineAmountWithoutTax = lineAmountWithoutTax,
                LineAmountWithTax = lineAmountWithTax,
                Total = lineAmountWithTax
            });
        }

        foreach (var product in touchedProducts)
        {
            var activeVariants = product.Variants.Where(variant => variant.IsActive && !variant.IsDeleted).ToArray();
            if (activeVariants.Length > 0)
            {
                product.Stock = activeVariants.Sum(variant => variant.Stock);
            }
        }

        var grossSubtotal = SafeRound(order.Items.Sum(item => item.LineAmountWithTax));
        var taxableSubtotal = SafeRound(order.Items.Sum(item => item.LineAmountWithoutTax));
        var taxTotal = SafeRound(order.Items.Sum(item => item.TaxAmount));

        order.Subtotal = taxableSubtotal;
        order.Discount = 0;

        if (!string.IsNullOrWhiteSpace(request.CouponCode))
        {
            var profile = await orderRepository.GetCustomerPromotionProfileAsync(order.CustomerEmail, cancellationToken);
            var promotions = await promotionRepository.ListAsync(cancellationToken);

            var evaluation = PromotionRuleEvaluator.EvaluateBest(promotions, new PromotionEvaluationContext(
                request.CouponCode,
                grossSubtotal,
                promotionLines,
                profile,
                DateTimeOffset.UtcNow,
                CouponOnly: true));

            if (!evaluation.IsValid)
            {
                throw new ValidationException(evaluation.Message);
            }

            order.Discount = Math.Min(evaluation.DiscountAmount, grossSubtotal);
        }

        order.Tax = taxTotal;
        order.TaxType = activeTaxType;
        order.TaxRate = taxRate;
        order.TaxIncludedInPrice = taxIncludedInPrice;
        order.Shipping = fulfillmentType == OrderFulfillmentType.StorePickup
            ? 0m
            : ResolveShippingCost(settings, request.Department, request.Province);
        order.Total = order.Subtotal - order.Discount + order.Tax + order.Shipping;

        var paymentResult = settings.PaymentGatewayEnabled
            ? await paymentPreparationService.PrepareAsync(order, cancellationToken)
            : new PaymentPreparationResult(
                Provider: "manual",
                Status: "pending_contact",
                IntegrationMode: "email_notification",
                ExternalReference: order.Number,
                PublicKey: null,
                ClientSecret: null,
                CheckoutUrl: null,
                QrCodeUrl: null,
                ExpiresAt: null,
                Instructions:
                [
                    "Tu pedido fue registrado correctamente.",
                    $"El equipo comercial recibio una notificacion en {settings.OrderNotificationEmail}.",
                    "En breve te contactaremos para coordinar el pago y el despacho."
                ]);
        var payment = new OrderPayment
        {
            OrderId = order.Id,
            Method = paymentMethod,
            Provider = paymentResult.Provider,
            Status = paymentResult.Status,
            IntegrationMode = paymentResult.IntegrationMode,
            Amount = order.Total,
            ExternalReference = paymentResult.ExternalReference,
            PublicKey = paymentResult.PublicKey,
            ClientSecret = paymentResult.ClientSecret,
            CheckoutUrl = paymentResult.CheckoutUrl,
            QrCodeUrl = paymentResult.QrCodeUrl,
            ExpiresAt = paymentResult.ExpiresAt,
            MetadataJson = string.Join(" | ", paymentResult.Instructions)
        };

        order.Payments.Add(payment);

        await orderRepository.AddAsync(order, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        if (!settings.PaymentGatewayEnabled)
        {
            try
            {
                await orderNotificationService.SendOrderReceivedEmailAsync(order, settings.OrderNotificationEmail, cancellationToken);
            }
            catch
            {
                // The order is already persisted; avoid breaking checkout response if notification fails.
            }
        }

        return new OrderCheckoutResultDto(
            order.Id,
            order.Number,
            order.Status.ToString().ToLowerInvariant(),
            order.Total,
            order.StoreId,
            order.StoreName,
            order.FulfillmentType == OrderFulfillmentType.StorePickup ? "pickup" : "shipping",
            new PaymentPreparationDto(
                payment.Id,
                payment.Provider,
                payment.Status,
                payment.IntegrationMode,
                payment.ExternalReference,
                payment.PublicKey,
                payment.ClientSecret,
                payment.CheckoutUrl,
                payment.QrCodeUrl,
                payment.ExpiresAt,
                paymentResult.Instructions));
    }

    private static string GenerateOrderNumber()
    {
        Span<char> suffix = stackalloc char[4];

        for (var i = 0; i < suffix.Length; i++)
        {
            suffix[i] = OrderCodeAlphabet[RandomNumberGenerator.GetInt32(OrderCodeAlphabet.Length)];
        }

        return $"ORD-{DateTime.UtcNow:yyMMdd}-{new string(suffix)}";
    }

    private static decimal SafeRound(decimal value) =>
        Math.Round(value, 2, MidpointRounding.AwayFromZero);

    private static decimal ResolveShippingCost(Domain.Common.StoreSettings settings, string department, string province)
    {
        var configuredShippingCost = settings.ProvinceShippingCost < 0
            ? 0m
            : SafeRound(settings.ProvinceShippingCost);

        if (!settings.FreeShippingLima)
        {
            return configuredShippingCost;
        }

        var normalizedDepartment = (department ?? string.Empty).Trim().ToUpperInvariant();
        var normalizedProvince = (province ?? string.Empty).Trim().ToUpperInvariant();
        var isLimaMetro = normalizedDepartment == "LIMA"
            || normalizedDepartment == "CALLAO"
            || normalizedProvince == "LIMA"
            || normalizedProvince == "CALLAO";

        return isLimaMetro ? 0m : configuredShippingCost;
    }

    private static (string TaxSchemeId, string TaxSchemeName, string TaxTypeCode, string TaxAffectationCode) ResolveTaxScheme(string taxType)
    {
        if (string.Equals(taxType, "IVA", StringComparison.OrdinalIgnoreCase))
        {
            return ("1000", "IVA", "VAT", "10");
        }

        return ("1000", "IGV", "VAT", "10");
    }
}