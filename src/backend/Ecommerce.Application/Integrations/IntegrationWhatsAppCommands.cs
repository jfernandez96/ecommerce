using Ecommerce.Application.Common;
using FluentValidation;
using MediatR;

namespace Ecommerce.Application.Integrations;

public sealed record SendIntegrationWhatsAppMessageCommand(
    string ClientId,
    string ToPhone,
    string Message,
    string? ExternalId,
    string? SourceSystem) : IRequest<IntegrationWhatsAppDispatchResultDto>;

public sealed class SendIntegrationWhatsAppMessageCommandValidator : AbstractValidator<SendIntegrationWhatsAppMessageCommand>
{
    public SendIntegrationWhatsAppMessageCommandValidator()
    {
        RuleFor(x => x.ClientId).NotEmpty().MaximumLength(120);
        RuleFor(x => x.ToPhone).NotEmpty().MaximumLength(30);
        RuleFor(x => x.Message).NotEmpty().MaximumLength(1200);
        RuleFor(x => x.ExternalId).MaximumLength(120);
        RuleFor(x => x.SourceSystem).MaximumLength(120);
    }
}

public sealed class SendIntegrationWhatsAppMessageCommandHandler(IWhatsAppNotificationService whatsAppNotificationService)
    : IRequestHandler<SendIntegrationWhatsAppMessageCommand, IntegrationWhatsAppDispatchResultDto>
{
    public async Task<IntegrationWhatsAppDispatchResultDto> Handle(SendIntegrationWhatsAppMessageCommand request, CancellationToken cancellationToken)
    {
        await whatsAppNotificationService.SendTestMessageAsync(request.ToPhone, request.Message, cancellationToken);

        return new IntegrationWhatsAppDispatchResultDto(
            Status: "sent",
            ClientId: request.ClientId,
            Message: "Mensaje enviado correctamente.",
            ExternalId: request.ExternalId,
            SentAt: DateTimeOffset.UtcNow);
    }
}
