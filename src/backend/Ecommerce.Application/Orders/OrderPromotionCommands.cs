using Ecommerce.Application.Common;
using Ecommerce.Application.Promotions;
using Ecommerce.Domain.Catalog;
using FluentValidation;
using MediatR;

namespace Ecommerce.Application.Orders;

public sealed record ValidateCheckoutCouponCommand(
    string CouponCode,
    string Email,
    decimal Subtotal,
    IReadOnlyList<CheckoutItemInput> Items) : IRequest<CouponValidationResultDto>;

public sealed class ValidateCheckoutCouponCommandValidator : AbstractValidator<ValidateCheckoutCouponCommand>
{
    public ValidateCheckoutCouponCommandValidator()
    {
        RuleFor(x => x.CouponCode).NotEmpty().MaximumLength(80);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.Subtotal).GreaterThan(0);
        RuleFor(x => x.Items).NotEmpty();
        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(x => x.ProductId).NotEmpty();
            item.RuleFor(x => x.Quantity).GreaterThan(0);
        });
    }
}

public sealed class ValidateCheckoutCouponCommandHandler(
    IPromotionRepository promotionRepository,
    IOrderRepository orderRepository,
    IProductRepository productRepository) : IRequestHandler<ValidateCheckoutCouponCommand, CouponValidationResultDto>
{
    public async Task<CouponValidationResultDto> Handle(ValidateCheckoutCouponCommand request, CancellationToken cancellationToken)
    {
        var products = new Dictionary<Guid, Product>();
        var lines = new List<PromotionCartLine>(request.Items.Count);

        foreach (var item in request.Items)
        {
            if (!products.TryGetValue(item.ProductId, out var product))
            {
                product = await productRepository.GetByIdAsync(item.ProductId, cancellationToken)
                    ?? throw new InvalidOperationException("Uno de los productos del carrito no existe.");
                products[item.ProductId] = product;
            }

            var variant = item.ProductVariantId.HasValue
                ? product.Variants.FirstOrDefault(current =>
                    current.Id == item.ProductVariantId.Value
                    && current.IsActive
                    && !current.IsDeleted)
                : null;

            var unitPrice = product.EffectivePrice + (variant?.PriceAdjustment ?? 0m);

            lines.Add(new PromotionCartLine(
                product.Id,
                product.CategoryId,
                product.BrandId,
                item.Quantity,
                unitPrice));
        }

        var profile = await orderRepository.GetCustomerPromotionProfileAsync(request.Email, cancellationToken);
        var promotions = await promotionRepository.ListAsync(cancellationToken);
        var evaluation = PromotionRuleEvaluator.EvaluateBest(promotions, new PromotionEvaluationContext(
            request.CouponCode,
            request.Subtotal,
            lines,
            profile,
            DateTimeOffset.UtcNow,
            CouponOnly: true));

        return new CouponValidationResultDto(
            evaluation.IsValid,
            evaluation.Message,
            evaluation.DiscountAmount,
            evaluation.FinalSubtotal,
            evaluation.PromotionName,
            evaluation.PromotionType);
    }
}
