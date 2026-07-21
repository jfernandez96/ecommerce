using System.Globalization;
using System.Text.RegularExpressions;
using Ecommerce.Application.Common;
using Ecommerce.Domain.Catalog;

namespace Ecommerce.Application.Promotions;

public sealed record PromotionCartLine(Guid ProductId, Guid CategoryId, Guid BrandId, int Quantity, decimal UnitPrice);

public sealed record PromotionEvaluationContext(
    string? CouponCode,
    decimal CartSubtotal,
    IReadOnlyList<PromotionCartLine> Lines,
    CustomerPromotionProfileDto Customer,
    DateTimeOffset Now,
    bool CouponOnly);

public sealed record PromotionEvaluationResult(
    bool IsValid,
    string Message,
    decimal DiscountAmount,
    decimal FinalSubtotal,
    string? PromotionName,
    string? PromotionType,
    Guid? PromotionId);

public static partial class PromotionRuleEvaluator
{
    public static PromotionEvaluationResult EvaluateBest(
        IReadOnlyList<Promotion> promotions,
        PromotionEvaluationContext context)
    {
        if (promotions.Count == 0)
        {
            return new PromotionEvaluationResult(false, "No hay promociones activas.", 0m, SafeRound(context.CartSubtotal), null, null, null);
        }

        var now = context.Now;
        var active = promotions
            .Where(p => p.IsActive && p.StartsAt <= now && p.EndsAt >= now)
            .ToArray();

        if (active.Length == 0)
        {
            return new PromotionEvaluationResult(false, "No hay promociones vigentes.", 0m, SafeRound(context.CartSubtotal), null, null, null);
        }

        var candidates = new List<(Promotion Promotion, decimal Discount)>();
        foreach (var promotion in active)
        {
            if (context.CouponOnly && !HasTag(promotion.Name, "COUPON"))
            {
                continue;
            }

            if (!MatchesScope(promotion, context.Lines))
            {
                continue;
            }

            if (!MatchesCustomerRules(promotion, context))
            {
                continue;
            }

            var discount = ComputeDiscount(promotion, context.Lines);
            if (discount <= 0) continue;

            candidates.Add((promotion, discount));
        }

        if (candidates.Count == 0)
        {
            return new PromotionEvaluationResult(false, "El cupon o regla no aplica para este carrito/cliente.", 0m, SafeRound(context.CartSubtotal), null, null, null);
        }

        var best = candidates
            .OrderByDescending(item => item.Discount)
            .ThenBy(item => item.Promotion.EndsAt)
            .First();

        var boundedDiscount = Math.Min(SafeRound(best.Discount), SafeRound(context.CartSubtotal));
        var finalSubtotal = SafeRound(context.CartSubtotal - boundedDiscount);

        return new PromotionEvaluationResult(
            true,
            "Promocion valida y aplicada.",
            boundedDiscount,
            finalSubtotal,
            best.Promotion.Name,
            best.Promotion.Type.ToString(),
            best.Promotion.Id);
    }

    private static bool MatchesScope(Promotion promotion, IReadOnlyList<PromotionCartLine> lines)
    {
        if (lines.Count == 0) return false;

        if (promotion.ProductId.HasValue)
        {
            return lines.Any(line => line.ProductId == promotion.ProductId.Value);
        }

        if (promotion.CategoryId.HasValue)
        {
            return lines.Any(line => line.CategoryId == promotion.CategoryId.Value);
        }

        if (promotion.BrandId.HasValue)
        {
            return lines.Any(line => line.BrandId == promotion.BrandId.Value);
        }

        return true;
    }

    private static IReadOnlyList<PromotionCartLine> GetEligibleLines(Promotion promotion, IReadOnlyList<PromotionCartLine> lines)
    {
        if (promotion.ProductId.HasValue)
        {
            return lines.Where(line => line.ProductId == promotion.ProductId.Value).ToArray();
        }

        if (promotion.CategoryId.HasValue)
        {
            return lines.Where(line => line.CategoryId == promotion.CategoryId.Value).ToArray();
        }

        if (promotion.BrandId.HasValue)
        {
            return lines.Where(line => line.BrandId == promotion.BrandId.Value).ToArray();
        }

        return lines;
    }

    private static bool MatchesCustomerRules(Promotion promotion, PromotionEvaluationContext context)
    {
        var name = promotion.Name;
        var couponTag = FindTag(name, "COUPON");

        if (!string.IsNullOrWhiteSpace(couponTag))
        {
            if (string.IsNullOrWhiteSpace(context.CouponCode)) return false;
            if (!couponTag.Equals(context.CouponCode.Trim(), StringComparison.OrdinalIgnoreCase)) return false;
        }

        var minOrderTag = FindTag(name, "MIN_ORDER");
        if (!string.IsNullOrWhiteSpace(minOrderTag)
            && decimal.TryParse(minOrderTag, NumberStyles.Number, CultureInfo.InvariantCulture, out var minOrder)
            && SafeRound(context.CartSubtotal) < SafeRound(minOrder))
        {
            return false;
        }

        var firstOrderTag = FindTag(name, "FIRST_ORDER");
        if (firstOrderTag.Equals("YES", StringComparison.OrdinalIgnoreCase)
            && context.Customer.TotalOrders > 0)
        {
            return false;
        }

        var segmentTag = FindTag(name, "SEGMENT");
        if (!string.IsNullOrWhiteSpace(segmentTag) && !MatchesSegment(segmentTag, context.Customer, context.Now))
        {
            return false;
        }

        var rfmTag = FindTag(name, "RFM");
        if (!string.IsNullOrWhiteSpace(rfmTag) && !MatchesRfm(rfmTag, context.Customer, context.Now))
        {
            return false;
        }

        return true;
    }

    private static bool MatchesSegment(string segmentTag, CustomerPromotionProfileDto customer, DateTimeOffset now)
    {
        var recencyDays = customer.LastOrderAt.HasValue ? (now - customer.LastOrderAt.Value).TotalDays : double.MaxValue;

        return segmentTag.Trim().ToUpperInvariant() switch
        {
            "ALL" => true,
            "NEW" => customer.TotalOrders == 0,
            "VIP" => customer.ConfirmedOrders >= 5 || customer.TotalSpent >= 1500m,
            "DORMANT" => customer.TotalOrders > 0 && recencyDays > 90,
            _ => false
        };
    }

    private static bool MatchesRfm(string rfmTag, CustomerPromotionProfileDto customer, DateTimeOffset now)
    {
        var recencyDays = customer.LastOrderAt.HasValue ? (now - customer.LastOrderAt.Value).TotalDays : double.MaxValue;

        return rfmTag.Trim().ToUpperInvariant() switch
        {
            "CHAMPIONS" => customer.ConfirmedOrders >= 5 && customer.TotalSpent >= 2000m && recencyDays <= 45,
            "LOYAL" => customer.ConfirmedOrders >= 3 && recencyDays <= 90,
            "AT-RISK" => customer.ConfirmedOrders >= 2 && recencyDays > 90,
            "NEW" => customer.TotalOrders <= 1,
            _ => false
        };
    }

    private static decimal ComputeDiscount(Promotion promotion, IReadOnlyList<PromotionCartLine> lines)
    {
        var eligibleLines = GetEligibleLines(promotion, lines);
        if (eligibleLines.Count == 0) return 0m;

        var eligibleSubtotal = SafeRound(eligibleLines.Sum(line => line.UnitPrice * line.Quantity));
        if (eligibleSubtotal <= 0) return 0m;

        decimal rawDiscount = promotion.Type switch
        {
            PromotionType.Percentage => eligibleSubtotal * (promotion.Value / 100m),
            PromotionType.FixedAmount => promotion.Value,
            PromotionType.TwoForOne => eligibleLines.Sum(line => Math.Floor(line.Quantity / 2m) * line.UnitPrice),
            PromotionType.ThreeForTwo => eligibleLines.Sum(line => Math.Floor(line.Quantity / 3m) * line.UnitPrice),
            _ => 0m
        };

        return Math.Max(0m, Math.Min(SafeRound(rawDiscount), eligibleSubtotal));
    }

    private static decimal SafeRound(decimal value) =>
        Math.Round(value, 2, MidpointRounding.AwayFromZero);

    private static bool HasTag(string input, string key)
    {
        return FindTag(input, key).Length > 0;
    }

    private static string FindTag(string input, string key)
    {
        if (string.IsNullOrWhiteSpace(input)) return string.Empty;

        foreach (Match match in PromotionTagRegex().Matches(input))
        {
            if (match.Groups.Count < 3) continue;
            if (match.Groups[1].Value.Equals(key, StringComparison.OrdinalIgnoreCase))
            {
                return match.Groups[2].Value.Trim();
            }
        }

        return string.Empty;
    }

    [GeneratedRegex("\\[(\\w+):([^\\]]+)\\]")]
    private static partial Regex PromotionTagRegex();
}
