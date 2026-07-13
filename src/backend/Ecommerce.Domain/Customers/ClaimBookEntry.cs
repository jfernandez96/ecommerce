using Ecommerce.Domain.Common;

namespace Ecommerce.Domain.Customers;

public sealed class ClaimBookEntry : AuditableEntity
{
    public string Code { get; set; } = string.Empty;

    // Consumer identification
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string DocumentType { get; set; } = string.Empty;
    public string DocumentNumber { get; set; } = string.Empty;
    public string ResponseChannel { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public bool IsMinor { get; set; }

    // Product/service identification
    public string ContractedGoodType { get; set; } = string.Empty;
    public string? OrderNumber { get; set; }
    public decimal? ClaimedAmount { get; set; }
    public string GoodDescription { get; set; } = string.Empty;

    // Claim detail
    public string ClaimType { get; set; } = string.Empty;
    public string ClaimDetail { get; set; } = string.Empty;
    public string ConsumerRequest { get; set; } = string.Empty;

    public bool AcceptedTerms { get; set; }
}
