using Ecommerce.Application.Common;
using Ecommerce.Domain.Common;
using FluentValidation;
using MediatR;

namespace Ecommerce.Application.Settings;

// ─── DTOs ───────────────────────────────────────────────────────────────────

public sealed record CompanySettingsDto(
    string CompanyRuc,
    string CompanyBusinessName,
    string StoreName,
    string CompanyAddress,
    string CompanyPhone,
    string CompanyEmail);

public sealed record ShippingSettingsDto(
    bool FreeShippingLima,
    decimal ProvinceShippingCost);

public sealed record TaxSettingsDto(
    string ActiveTaxType,
    decimal IgvRate,
    decimal IvaRate,
    bool TaxIncludedInPrice);

public sealed record PaymentSettingsDto(
    bool PaymentGatewayEnabled,
    string? YapeApiKey,
    string? YapeSecretKey,
    string? YapeMerchantId,
    string? YapeWebhookSecret,
    string? CardPublicKey,
    string? CardSecretKey,
    string? CardWebhookSecret,
    string? CardProvider,
    string OrderNotificationEmail,
    string? SmtpHost,
    int SmtpPort,
    string? SmtpUser,
    string? SmtpPassword,
    bool SmtpUseSsl,
    string? SmtpFromEmail,
    string? SmtpFromName);

public sealed record SunatSettingsDto(
    string? SunatSolUser,
    string? SunatSolPassword,
    string? SunatCertificateFileName,
    string? SunatServiceEndpoint,
    string SunatEnvironment,
    string SunatEstablishmentCode,
    string SunatReceiptSeries,
    string SunatInvoiceSeries,
    int SunatReceiptNextCorrelative,
    int SunatInvoiceNextCorrelative);

public sealed record WhatsAppSettingsDto(
    bool WhatsAppEnabled,
    string? WhatsAppApiUrl,
    string? WhatsAppApiVersion,
    string? WhatsAppApiKey,
    string? WhatsAppSecretKey,
    string? WhatsAppPhoneNumberId,
    string? WhatsAppDefaultCountryCode,
    string? WhatsAppConfirmTemplate,
    string? WhatsAppRejectTemplate);

public sealed record StoreSettingsDto(
    CompanySettingsDto Company,
    ShippingSettingsDto Shipping,
    TaxSettingsDto Tax,
    PaymentSettingsDto Payment,
    SunatSettingsDto Sunat,
    WhatsAppSettingsDto WhatsApp);

public sealed record PublicStoreSettingsDto(
    bool PaymentGatewayEnabled,
    bool FreeShippingLima,
    decimal ProvinceShippingCost);

public sealed record PublicFooterSettingsDto(
    string CompanyRuc,
    string CompanyBusinessName,
    string StoreName,
    string CompanyAddress,
    string CompanyPhone,
    string CompanyEmail);

public sealed record SendTestEmailCommand(string ToEmail) : IRequest<Unit>;
public sealed record SendTestWhatsAppCommand(string ToPhone, string Message) : IRequest<Unit>;

// ─── Queries ─────────────────────────────────────────────────────────────────

public sealed record GetStoreSettingsQuery : IRequest<StoreSettingsDto>;

public sealed class GetStoreSettingsQueryHandler(IStoreSettingsRepository repository)
    : IRequestHandler<GetStoreSettingsQuery, StoreSettingsDto>
{
    public async Task<StoreSettingsDto> Handle(GetStoreSettingsQuery request, CancellationToken cancellationToken)
    {
        var settings = await repository.GetOrCreateAsync(cancellationToken);
        return Map(settings);
    }

    internal static StoreSettingsDto Map(StoreSettings s) => new(
        new(
            s.CompanyRuc,
            s.CompanyBusinessName,
            s.StoreName,
            s.CompanyAddress,
            s.CompanyPhone,
            s.CompanyEmail),
        new(s.FreeShippingLima, s.ProvinceShippingCost),
        new(
            s.ActiveTaxType,
            s.IgvRate,
            s.IvaRate,
            s.TaxIncludedInPrice),
        new(
            s.PaymentGatewayEnabled,
            s.YapeApiKey,
            s.YapeSecretKey,
            s.YapeMerchantId,
            s.YapeWebhookSecret,
            s.CardPublicKey,
            s.CardSecretKey,
            s.CardWebhookSecret,
            s.CardProvider,
            s.OrderNotificationEmail,
            s.SmtpHost,
            s.SmtpPort,
            s.SmtpUser,
            s.SmtpPassword,
            s.SmtpUseSsl,
            s.SmtpFromEmail,
            s.SmtpFromName),
        new(
            s.SunatSolUser,
            s.SunatSolPassword,
            s.SunatCertificateFileName,
            s.SunatServiceEndpoint,
            s.SunatEnvironment,
            s.SunatEstablishmentCode,
            s.SunatReceiptSeries,
            s.SunatInvoiceSeries,
            s.SunatReceiptNextCorrelative,
            s.SunatInvoiceNextCorrelative),
        new(
            s.WhatsAppEnabled,
            s.WhatsAppApiUrl,
            s.WhatsAppApiVersion,
            s.WhatsAppApiKey,
            s.WhatsAppSecretKey,
            s.WhatsAppPhoneNumberId,
            s.WhatsAppDefaultCountryCode,
            s.WhatsAppConfirmTemplate,
            s.WhatsAppRejectTemplate));

    internal static PublicFooterSettingsDto MapPublicFooter(StoreSettings s) => new(
        s.CompanyRuc,
        s.CompanyBusinessName,
        s.StoreName,
        s.CompanyAddress,
        s.CompanyPhone,
        s.CompanyEmail);
}

// ─── Commands ────────────────────────────────────────────────────────────────

public sealed record UpdateCompanySettingsCommand(
    string CompanyRuc,
    string CompanyBusinessName,
    string StoreName,
    string CompanyAddress,
    string CompanyPhone,
    string CompanyEmail) : IRequest<StoreSettingsDto>;

public sealed class UpdateCompanySettingsCommandHandler(IStoreSettingsRepository repository, IUnitOfWork unitOfWork)
    : IRequestHandler<UpdateCompanySettingsCommand, StoreSettingsDto>
{
    public async Task<StoreSettingsDto> Handle(UpdateCompanySettingsCommand request, CancellationToken cancellationToken)
    {
        var settings = await repository.GetOrCreateAsync(cancellationToken);
        settings.CompanyRuc = request.CompanyRuc.Trim();
        settings.CompanyBusinessName = request.CompanyBusinessName.Trim();
        settings.StoreName = request.StoreName.Trim();
        settings.CompanyAddress = request.CompanyAddress.Trim();
        settings.CompanyPhone = request.CompanyPhone.Trim();
        settings.CompanyEmail = request.CompanyEmail.Trim();
        settings.UpdatedAt = DateTimeOffset.UtcNow;
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return GetStoreSettingsQueryHandler.Map(settings);
    }
}

public sealed class UpdateCompanySettingsValidator : AbstractValidator<UpdateCompanySettingsCommand>
{
    public UpdateCompanySettingsValidator()
    {
        RuleFor(x => x.CompanyRuc).NotEmpty().MaximumLength(20);
        RuleFor(x => x.CompanyBusinessName).NotEmpty().MaximumLength(180);
        RuleFor(x => x.StoreName).NotEmpty().MaximumLength(50);
        RuleFor(x => x.CompanyAddress).NotEmpty().MaximumLength(280);
        RuleFor(x => x.CompanyPhone).NotEmpty().MaximumLength(40);
        RuleFor(x => x.CompanyEmail).NotEmpty().EmailAddress().MaximumLength(256);
    }
}

public sealed record UpdateShippingSettingsCommand(
    bool FreeShippingLima,
    decimal ProvinceShippingCost) : IRequest<StoreSettingsDto>;

public sealed class UpdateShippingSettingsCommandHandler(IStoreSettingsRepository repository, IUnitOfWork unitOfWork)
    : IRequestHandler<UpdateShippingSettingsCommand, StoreSettingsDto>
{
    public async Task<StoreSettingsDto> Handle(UpdateShippingSettingsCommand request, CancellationToken cancellationToken)
    {
        var settings = await repository.GetOrCreateAsync(cancellationToken);
        settings.FreeShippingLima = request.FreeShippingLima;
        settings.ProvinceShippingCost = request.ProvinceShippingCost;
        settings.UpdatedAt = DateTimeOffset.UtcNow;
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return GetStoreSettingsQueryHandler.Map(settings);
    }
}

public sealed class UpdateShippingSettingsValidator : AbstractValidator<UpdateShippingSettingsCommand>
{
    public UpdateShippingSettingsValidator()
    {
        RuleFor(x => x.ProvinceShippingCost).GreaterThanOrEqualTo(0).WithMessage("El costo de envio a provincia debe ser 0 o mayor.");
    }
}

public sealed record UpdateTaxSettingsCommand(
    string ActiveTaxType,
    decimal IgvRate,
    decimal IvaRate,
    bool TaxIncludedInPrice) : IRequest<StoreSettingsDto>;

public sealed class UpdateTaxSettingsCommandHandler(IStoreSettingsRepository repository, IUnitOfWork unitOfWork)
    : IRequestHandler<UpdateTaxSettingsCommand, StoreSettingsDto>
{
    public async Task<StoreSettingsDto> Handle(UpdateTaxSettingsCommand request, CancellationToken cancellationToken)
    {
        var settings = await repository.GetOrCreateAsync(cancellationToken);
        settings.ActiveTaxType = request.ActiveTaxType.Trim().ToUpperInvariant();
        settings.IgvRate = request.IgvRate;
        settings.IvaRate = request.IvaRate;
        settings.TaxIncludedInPrice = request.TaxIncludedInPrice;
        settings.UpdatedAt = DateTimeOffset.UtcNow;
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return GetStoreSettingsQueryHandler.Map(settings);
    }
}

public sealed class UpdateTaxSettingsValidator : AbstractValidator<UpdateTaxSettingsCommand>
{
    public UpdateTaxSettingsValidator()
    {
        RuleFor(x => x.ActiveTaxType)
            .Must(value => string.Equals(value, "IGV", StringComparison.OrdinalIgnoreCase)
                           || string.Equals(value, "IVA", StringComparison.OrdinalIgnoreCase))
            .WithMessage("El impuesto activo debe ser IGV o IVA.");

        RuleFor(x => x.IgvRate)
            .InclusiveBetween(0m, 100m)
            .WithMessage("La tasa IGV debe estar entre 0 y 100.");

        RuleFor(x => x.IvaRate)
            .InclusiveBetween(0m, 100m)
            .WithMessage("La tasa IVA debe estar entre 0 y 100.");
    }
}

public sealed record UpdatePaymentSettingsCommand(
    bool PaymentGatewayEnabled,
    string? YapeApiKey,
    string? YapeSecretKey,
    string? YapeMerchantId,
    string? YapeWebhookSecret,
    string? CardPublicKey,
    string? CardSecretKey,
    string? CardWebhookSecret,
    string? CardProvider,
    string OrderNotificationEmail,
    string? SmtpHost,
    int SmtpPort,
    string? SmtpUser,
    string? SmtpPassword,
    bool SmtpUseSsl,
    string? SmtpFromEmail,
    string? SmtpFromName) : IRequest<StoreSettingsDto>;

public sealed record UpdateSunatSettingsCommand(
    string? SunatSolUser,
    string? SunatSolPassword,
    string? SunatCertificateFileName,
    string? SunatCertificatePassword,
    string? SunatCertificateBase64,
    string? SunatServiceEndpoint,
    string SunatEnvironment,
    string SunatEstablishmentCode,
    string SunatReceiptSeries,
    string SunatInvoiceSeries,
    int SunatReceiptNextCorrelative,
    int SunatInvoiceNextCorrelative,
    bool RemoveCertificate) : IRequest<StoreSettingsDto>;

public sealed class UpdatePaymentSettingsCommandHandler(IStoreSettingsRepository repository, IUnitOfWork unitOfWork)
    : IRequestHandler<UpdatePaymentSettingsCommand, StoreSettingsDto>
{
    public async Task<StoreSettingsDto> Handle(UpdatePaymentSettingsCommand request, CancellationToken cancellationToken)
    {
        var settings = await repository.GetOrCreateAsync(cancellationToken);
        settings.PaymentGatewayEnabled = request.PaymentGatewayEnabled;
        settings.YapeApiKey = request.PaymentGatewayEnabled ? request.YapeApiKey : null;
        settings.YapeSecretKey = request.PaymentGatewayEnabled ? request.YapeSecretKey : null;
        settings.YapeMerchantId = request.PaymentGatewayEnabled ? request.YapeMerchantId : null;
        settings.YapeWebhookSecret = request.PaymentGatewayEnabled ? request.YapeWebhookSecret : null;
        settings.CardPublicKey = request.PaymentGatewayEnabled ? request.CardPublicKey : null;
        settings.CardSecretKey = request.PaymentGatewayEnabled ? request.CardSecretKey : null;
        settings.CardWebhookSecret = request.PaymentGatewayEnabled ? request.CardWebhookSecret : null;
        settings.CardProvider = request.PaymentGatewayEnabled ? request.CardProvider : null;
        settings.OrderNotificationEmail = request.OrderNotificationEmail;
        settings.SmtpHost = request.SmtpHost?.Trim();
        settings.SmtpPort = request.SmtpPort;
        settings.SmtpUser = request.SmtpUser?.Trim();
        settings.SmtpPassword = request.SmtpPassword;
        settings.SmtpUseSsl = request.SmtpUseSsl;
        settings.SmtpFromEmail = request.SmtpFromEmail?.Trim();
        settings.SmtpFromName = request.SmtpFromName?.Trim();
        settings.UpdatedAt = DateTimeOffset.UtcNow;
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return GetStoreSettingsQueryHandler.Map(settings);
    }
}

public sealed class UpdatePaymentSettingsValidator : AbstractValidator<UpdatePaymentSettingsCommand>
{
    public UpdatePaymentSettingsValidator()
    {
        RuleFor(x => x.OrderNotificationEmail)
            .NotEmpty().WithMessage("El correo de notificacion es obligatorio.")
            .EmailAddress().WithMessage("Ingresa un correo valido.");

        RuleFor(x => x.SmtpPort)
            .InclusiveBetween(1, 65535)
            .WithMessage("El puerto SMTP debe estar entre 1 y 65535.");

        RuleFor(x => x.SmtpHost)
            .NotEmpty().WithMessage("El host SMTP es obligatorio.");

        RuleFor(x => x.SmtpFromEmail)
            .NotEmpty().WithMessage("El correo remitente SMTP es obligatorio.")
            .EmailAddress().WithMessage("El correo remitente SMTP no es valido.");

        RuleFor(x => x.SmtpFromName)
            .MaximumLength(120)
            .WithMessage("El nombre del remitente no debe superar 120 caracteres.");

        RuleFor(x => x)
            .Must(x =>
                (string.IsNullOrWhiteSpace(x.SmtpUser) && string.IsNullOrWhiteSpace(x.SmtpPassword)) ||
                (!string.IsNullOrWhiteSpace(x.SmtpUser) && !string.IsNullOrWhiteSpace(x.SmtpPassword)))
            .WithMessage("Para autenticacion SMTP debes completar usuario y password, o dejar ambos vacios.");

        When(x => x.PaymentGatewayEnabled, () =>
        {
            RuleFor(x => x.CardProvider)
                .Must(v => v is null || v == "stripe" || v == "mercadopago")
                .WithMessage("Proveedor de tarjeta invalido. Usa 'stripe' o 'mercadopago'.");
        });
    }
}

public sealed class UpdateSunatSettingsCommandHandler(IStoreSettingsRepository repository, IUnitOfWork unitOfWork)
    : IRequestHandler<UpdateSunatSettingsCommand, StoreSettingsDto>
{
    public async Task<StoreSettingsDto> Handle(UpdateSunatSettingsCommand request, CancellationToken cancellationToken)
    {
        var settings = await repository.GetOrCreateAsync(cancellationToken);
        settings.SunatSolUser = request.SunatSolUser?.Trim();
        settings.SunatSolPassword = request.SunatSolPassword?.Trim();
        settings.SunatServiceEndpoint = request.SunatServiceEndpoint?.Trim();
        settings.SunatEnvironment = request.SunatEnvironment.Trim().ToLowerInvariant();
        settings.SunatEstablishmentCode = request.SunatEstablishmentCode.Trim();
        settings.SunatReceiptSeries = request.SunatReceiptSeries.Trim().ToUpperInvariant();
        settings.SunatInvoiceSeries = request.SunatInvoiceSeries.Trim().ToUpperInvariant();
        settings.SunatReceiptNextCorrelative = request.SunatReceiptNextCorrelative;
        settings.SunatInvoiceNextCorrelative = request.SunatInvoiceNextCorrelative;

        if (request.RemoveCertificate)
        {
            settings.SunatCertificateFileName = null;
            settings.SunatCertificatePassword = null;
            settings.SunatCertificateBase64 = null;
        }
        else
        {
            if (!string.IsNullOrWhiteSpace(request.SunatCertificatePassword))
            {
                settings.SunatCertificatePassword = request.SunatCertificatePassword.Trim();
            }

            if (!string.IsNullOrWhiteSpace(request.SunatCertificateBase64))
            {
                settings.SunatCertificateFileName = request.SunatCertificateFileName?.Trim();
                settings.SunatCertificateBase64 = request.SunatCertificateBase64.Trim();
            }
        }

        settings.UpdatedAt = DateTimeOffset.UtcNow;
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return GetStoreSettingsQueryHandler.Map(settings);
    }
}

public sealed class UpdateSunatSettingsValidator : AbstractValidator<UpdateSunatSettingsCommand>
{
    public UpdateSunatSettingsValidator()
    {
        RuleFor(x => x.SunatSolUser)
            .MaximumLength(120)
            .WithMessage("El usuario SOL no debe superar 120 caracteres.");

        RuleFor(x => x.SunatSolPassword)
            .MaximumLength(120)
            .WithMessage("La clave SOL no debe superar 120 caracteres.");

        RuleFor(x => x.SunatCertificateFileName)
            .MaximumLength(260)
            .WithMessage("El nombre del certificado no debe superar 260 caracteres.");

        RuleFor(x => x.SunatCertificatePassword)
            .MaximumLength(120)
            .WithMessage("La clave del certificado no debe superar 120 caracteres.");

        RuleFor(x => x.SunatServiceEndpoint)
            .MaximumLength(400)
            .WithMessage("El endpoint SUNAT no debe superar 400 caracteres.");

        RuleFor(x => x.SunatEnvironment)
            .NotEmpty().WithMessage("Debes indicar el entorno SUNAT.")
            .Must(value => value is "development" or "production")
            .WithMessage("El entorno SUNAT debe ser development o production.");

        RuleFor(x => x.SunatEstablishmentCode)
            .NotEmpty().WithMessage("El codigo de local anexo es obligatorio.")
            .MaximumLength(4).WithMessage("El codigo de local anexo no debe superar 4 caracteres.")
            .Matches("^[0-9]{4}$").WithMessage("El codigo de local anexo debe tener 4 digitos (ej. 0000).");

        RuleFor(x => x.SunatReceiptSeries)
            .NotEmpty().WithMessage("La serie de boleta es obligatoria.")
            .MaximumLength(10).WithMessage("La serie de boleta no debe superar 10 caracteres.")
            .Matches("^[A-Za-z0-9-]+$").WithMessage("La serie de boleta solo admite letras, numeros y guion.");

        RuleFor(x => x.SunatInvoiceSeries)
            .NotEmpty().WithMessage("La serie de factura es obligatoria.")
            .MaximumLength(10).WithMessage("La serie de factura no debe superar 10 caracteres.")
            .Matches("^[A-Za-z0-9-]+$").WithMessage("La serie de factura solo admite letras, numeros y guion.");

        RuleFor(x => x.SunatReceiptNextCorrelative)
            .GreaterThan(0)
            .WithMessage("El correlativo de boleta debe iniciar en 1 o mayor.");

        RuleFor(x => x.SunatInvoiceNextCorrelative)
            .GreaterThan(0)
            .WithMessage("El correlativo de factura debe iniciar en 1 o mayor.");

        RuleFor(x => x)
            .Must(x => x.RemoveCertificate || string.IsNullOrWhiteSpace(x.SunatCertificateFileName) == string.IsNullOrWhiteSpace(x.SunatCertificateBase64))
            .WithMessage("Cuando subes un certificado debes enviar el archivo y su nombre.");
    }
}

public sealed record UpdateWhatsAppSettingsCommand(
    bool WhatsAppEnabled,
    string? WhatsAppApiUrl,
    string? WhatsAppApiVersion,
    string? WhatsAppApiKey,
    string? WhatsAppSecretKey,
    string? WhatsAppPhoneNumberId,
    string? WhatsAppDefaultCountryCode,
    string? WhatsAppConfirmTemplate,
    string? WhatsAppRejectTemplate) : IRequest<StoreSettingsDto>;

public sealed class UpdateWhatsAppSettingsCommandHandler(IStoreSettingsRepository repository, IUnitOfWork unitOfWork)
    : IRequestHandler<UpdateWhatsAppSettingsCommand, StoreSettingsDto>
{
    public async Task<StoreSettingsDto> Handle(UpdateWhatsAppSettingsCommand request, CancellationToken cancellationToken)
    {
        var settings = await repository.GetOrCreateAsync(cancellationToken);
        settings.WhatsAppEnabled = request.WhatsAppEnabled;
        settings.WhatsAppApiUrl = request.WhatsAppApiUrl?.Trim();
        settings.WhatsAppApiVersion = request.WhatsAppApiVersion?.Trim();
        settings.WhatsAppApiKey = request.WhatsAppApiKey?.Trim();
        settings.WhatsAppSecretKey = request.WhatsAppSecretKey?.Trim();
        settings.WhatsAppPhoneNumberId = request.WhatsAppPhoneNumberId?.Trim();
        settings.WhatsAppDefaultCountryCode = request.WhatsAppDefaultCountryCode?.Trim();
        settings.WhatsAppConfirmTemplate = request.WhatsAppConfirmTemplate?.Trim();
        settings.WhatsAppRejectTemplate = request.WhatsAppRejectTemplate?.Trim();
        settings.UpdatedAt = DateTimeOffset.UtcNow;
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return GetStoreSettingsQueryHandler.Map(settings);
    }
}

public sealed class UpdateWhatsAppSettingsValidator : AbstractValidator<UpdateWhatsAppSettingsCommand>
{
    public UpdateWhatsAppSettingsValidator()
    {
        RuleFor(x => x.WhatsAppApiUrl)
            .MaximumLength(260)
            .WithMessage("La URL base de WhatsApp no debe superar 260 caracteres.");

        RuleFor(x => x.WhatsAppApiVersion)
            .MaximumLength(20)
            .WithMessage("La version de WhatsApp no debe superar 20 caracteres.");

        RuleFor(x => x.WhatsAppPhoneNumberId)
            .MaximumLength(80)
            .WithMessage("El Phone Number ID no debe superar 80 caracteres.");

        RuleFor(x => x.WhatsAppDefaultCountryCode)
            .MaximumLength(6)
            .WithMessage("El codigo de pais no debe superar 6 caracteres.");

        RuleFor(x => x.WhatsAppConfirmTemplate)
            .MaximumLength(1200)
            .WithMessage("La plantilla de confirmacion no debe superar 1200 caracteres.");

        RuleFor(x => x.WhatsAppRejectTemplate)
            .MaximumLength(1200)
            .WithMessage("La plantilla de rechazo no debe superar 1200 caracteres.");

        When(x => x.WhatsAppEnabled, () =>
        {
            RuleFor(x => x.WhatsAppApiUrl)
                .NotEmpty().WithMessage("La URL base de WhatsApp es obligatoria.");

            RuleFor(x => x.WhatsAppApiVersion)
                .NotEmpty().WithMessage("La version de WhatsApp es obligatoria.");

            RuleFor(x => x.WhatsAppApiKey)
                .NotEmpty().WithMessage("La API key de WhatsApp es obligatoria.");

            RuleFor(x => x.WhatsAppPhoneNumberId)
                .NotEmpty().WithMessage("El Phone Number ID de WhatsApp es obligatorio.");

            RuleFor(x => x.WhatsAppDefaultCountryCode)
                .NotEmpty().WithMessage("El codigo de pais por defecto es obligatorio.")
                .Matches("^[0-9]+$").WithMessage("El codigo de pais de WhatsApp solo debe contener numeros.");
        });
    }
}

public sealed class SendTestEmailCommandHandler(IOrderNotificationService orderNotificationService)
    : IRequestHandler<SendTestEmailCommand, Unit>
{
    public async Task<Unit> Handle(SendTestEmailCommand request, CancellationToken cancellationToken)
    {
        await orderNotificationService.SendSmtpTestEmailAsync(request.ToEmail.Trim(), cancellationToken);
        return Unit.Value;
    }
}

public sealed class SendTestWhatsAppCommandHandler(IWhatsAppNotificationService whatsAppNotificationService)
    : IRequestHandler<SendTestWhatsAppCommand, Unit>
{
    public async Task<Unit> Handle(SendTestWhatsAppCommand request, CancellationToken cancellationToken)
    {
        await whatsAppNotificationService.SendTestMessageAsync(request.ToPhone.Trim(), request.Message.Trim(), cancellationToken);
        return Unit.Value;
    }
}

public sealed class SendTestEmailCommandValidator : AbstractValidator<SendTestEmailCommand>
{
    public SendTestEmailCommandValidator()
    {
        RuleFor(x => x.ToEmail)
            .NotEmpty().WithMessage("El correo destino es obligatorio.")
            .EmailAddress().WithMessage("Ingresa un correo valido para la prueba SMTP.");
    }
}

public sealed class SendTestWhatsAppCommandValidator : AbstractValidator<SendTestWhatsAppCommand>
{
    public SendTestWhatsAppCommandValidator()
    {
        RuleFor(x => x.ToPhone)
            .NotEmpty().WithMessage("El telefono destino es obligatorio.")
            .MaximumLength(30).WithMessage("El telefono destino no debe superar 30 caracteres.");

        RuleFor(x => x.Message)
            .NotEmpty().WithMessage("El mensaje de prueba es obligatorio.")
            .MaximumLength(1200).WithMessage("El mensaje de prueba no debe superar 1200 caracteres.");
    }
}
