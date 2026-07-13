using Ecommerce.Application.Common;
using Ecommerce.Domain.Customers;
using FluentValidation;
using MediatR;

namespace Ecommerce.Application.Claims;

public sealed record RegisterClaimBookEntryCommand(
    string FirstName,
    string LastName,
    string DocumentType,
    string DocumentNumber,
    string ResponseChannel,
    string Email,
    string Address,
    string? Phone,
    bool IsMinor,
    string ContractedGoodType,
    string? OrderNumber,
    decimal? ClaimedAmount,
    string GoodDescription,
    string ClaimType,
    string ClaimDetail,
    string ConsumerRequest,
    bool AcceptedTerms) : IRequest<RegisterClaimBookEntryResultDto>;

public sealed record RegisterClaimBookEntryResultDto(Guid Id, string Code, DateTimeOffset CreatedAt);

public sealed class RegisterClaimBookEntryCommandHandler(IClaimBookRepository repository, IUnitOfWork unitOfWork)
    : IRequestHandler<RegisterClaimBookEntryCommand, RegisterClaimBookEntryResultDto>
{
    public async Task<RegisterClaimBookEntryResultDto> Handle(RegisterClaimBookEntryCommand request, CancellationToken cancellationToken)
    {
        var entry = new ClaimBookEntry
        {
            Code = BuildCode(),
            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim(),
            DocumentType = request.DocumentType.Trim(),
            DocumentNumber = request.DocumentNumber.Trim(),
            ResponseChannel = request.ResponseChannel.Trim(),
            Email = request.Email.Trim(),
            Address = request.Address.Trim(),
            Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim(),
            IsMinor = request.IsMinor,
            ContractedGoodType = request.ContractedGoodType.Trim(),
            OrderNumber = string.IsNullOrWhiteSpace(request.OrderNumber) ? null : request.OrderNumber.Trim(),
            ClaimedAmount = request.ClaimedAmount,
            GoodDescription = request.GoodDescription.Trim(),
            ClaimType = request.ClaimType.Trim(),
            ClaimDetail = request.ClaimDetail.Trim(),
            ConsumerRequest = request.ConsumerRequest.Trim(),
            AcceptedTerms = request.AcceptedTerms
        };

        await repository.AddAsync(entry, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new RegisterClaimBookEntryResultDto(entry.Id, entry.Code, entry.CreatedAt);
    }

    private static string BuildCode() => $"{DateTime.UtcNow:yyyyMMddHHmmss}-{Random.Shared.Next(1000, 9999)}";
}

public sealed class RegisterClaimBookEntryCommandValidator : AbstractValidator<RegisterClaimBookEntryCommand>
{
    public RegisterClaimBookEntryCommandValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(120);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(120);
        RuleFor(x => x.DocumentType).NotEmpty().MaximumLength(30);
        RuleFor(x => x.DocumentNumber).NotEmpty().MaximumLength(20);
        RuleFor(x => x.ResponseChannel).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.Address).NotEmpty().MaximumLength(240);
        RuleFor(x => x.Phone).MaximumLength(30);
        RuleFor(x => x.ContractedGoodType).NotEmpty().MaximumLength(40);
        RuleFor(x => x.OrderNumber).MaximumLength(40);
        RuleFor(x => x.ClaimedAmount).GreaterThanOrEqualTo(0).When(x => x.ClaimedAmount.HasValue);
        RuleFor(x => x.GoodDescription).NotEmpty().MaximumLength(2000);
        RuleFor(x => x.ClaimType).NotEmpty().MaximumLength(30);
        RuleFor(x => x.ClaimDetail).NotEmpty().MaximumLength(4000);
        RuleFor(x => x.ConsumerRequest).NotEmpty().MaximumLength(2000);
        RuleFor(x => x.AcceptedTerms).Equal(true).WithMessage("Debes aceptar terminos y condiciones.");
    }
}
