using Ecommerce.Application.Common;
using Ecommerce.Domain.Orders;
using Ecommerce.Domain.Sales;
using MediatR;
using System.Text;

namespace Ecommerce.Application.Sales;

public sealed record SendSaleToSunatCommand(Guid OrderId) : IRequest<SendSaleToSunatResultDto>;

public sealed record SendSaleToSunatResultDto(
    Guid OrderId,
    string Status,
    string Message,
    string XmlFileName,
    string? Ticket,
    string? DigestValue,
    DateTimeOffset SentAt,
    DateTimeOffset? AcceptedAt);

public sealed class SendSaleToSunatCommandHandler(
    ISaleRepository saleRepository,
    IStoreSettingsRepository storeSettingsRepository,
    ISunatInvoiceService sunatInvoiceService,
    IUnitOfWork unitOfWork)
    : IRequestHandler<SendSaleToSunatCommand, SendSaleToSunatResultDto>
{
    public async Task<SendSaleToSunatResultDto> Handle(SendSaleToSunatCommand request, CancellationToken cancellationToken)
    {
        var sale = await saleRepository.GetByOrderIdAsync(request.OrderId, cancellationToken)
            ?? throw new InvalidOperationException("No se encontro la venta asociada a la orden indicada.");

        if (sale.PaymentStatus != SalePaymentStatus.Confirmed)
        {
            throw new InvalidOperationException("Solo se puede enviar a SUNAT una venta con pago confirmado.");
        }

        if (sale.SaleStatus is SaleStatus.Cancelled or SaleStatus.Returned)
        {
            throw new InvalidOperationException("No se puede enviar a SUNAT una venta anulada o devuelta.");
        }

        if (sale.SunatStatus == "accepted")
        {
            throw new InvalidOperationException("La venta ya fue aceptada por SUNAT.");
        }

        var settings = await storeSettingsRepository.GetOrCreateAsync(cancellationToken);
        SunatSubmissionResult submission;
        try
        {
            submission = await sunatInvoiceService.SubmitSaleAsync(sale, settings, cancellationToken);
        }
        catch (Exception ex)
        {
            var businessNow = DateTimeOffset.UtcNow;
            var message = ex.Message.Length <= 600 ? ex.Message : ex.Message[..600];

            sale.SunatStatus = "error";
            sale.SunatStatusMessage = message;
            sale.SunatRawResponse = ex.ToString();
            sale.SunatSentAt = businessNow;
            sale.SunatAcceptedAt = null;

            await unitOfWork.SaveChangesAsync(cancellationToken);

            return new SendSaleToSunatResultDto(
                sale.OrderId ?? request.OrderId,
                sale.SunatStatus,
                sale.SunatStatusMessage ?? message,
                sale.SunatXmlFileName ?? string.Empty,
                sale.SunatTicket,
                sale.SunatDigestValue,
                sale.SunatSentAt ?? businessNow,
                sale.SunatAcceptedAt);
        }

        sale.SunatStatus = submission.Status;
        sale.SunatStatusMessage = submission.Message;
        sale.SunatTicket = submission.Ticket;
        sale.SunatDigestValue = submission.DigestValue;
        sale.SunatXmlFileName = submission.XmlFileName;
        sale.SunatXmlContent = submission.SignedXml;
        sale.SunatCdrFileName = submission.CdrFileName;
        sale.SunatCdrContent = submission.CdrXmlContent;
        sale.SunatRawResponse = submission.RawResponse;
        sale.SunatXmlStoragePath = submission.XmlStoragePath;
        sale.SunatCdrStoragePath = submission.CdrStoragePath;
        sale.SunatSentAt = submission.SentAt;
        sale.SunatAcceptedAt = submission.AcceptedAt;

        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new SendSaleToSunatResultDto(
            sale.OrderId ?? request.OrderId,
            sale.SunatStatus,
            sale.SunatStatusMessage ?? string.Empty,
            sale.SunatXmlFileName ?? submission.XmlFileName,
            sale.SunatTicket,
            sale.SunatDigestValue,
            sale.SunatSentAt ?? submission.SentAt,
            sale.SunatAcceptedAt);
    }
}

public sealed record DownloadSaleSunatXmlQuery(Guid OrderId) : IRequest<ExportedFileDto>;
public sealed record DownloadSaleSunatCdrQuery(Guid OrderId) : IRequest<ExportedFileDto>;

public sealed class DownloadSaleSunatXmlQueryHandler(ISaleRepository saleRepository)
    : IRequestHandler<DownloadSaleSunatXmlQuery, ExportedFileDto>
{
    public async Task<ExportedFileDto> Handle(DownloadSaleSunatXmlQuery request, CancellationToken cancellationToken)
    {
        var sale = await saleRepository.GetByOrderIdAsync(request.OrderId, cancellationToken)
            ?? throw new InvalidOperationException("No se encontro la venta asociada a la orden indicada.");

        if (sale.SunatStatus != "accepted")
        {
            throw new InvalidOperationException("Solo se puede descargar XML para comprobantes aceptados por SUNAT.");
        }

        var fileName = string.IsNullOrWhiteSpace(sale.SunatXmlFileName)
            ? $"sunat-{request.OrderId:N}.xml"
            : sale.SunatXmlFileName;

        if (!string.IsNullOrWhiteSpace(sale.SunatXmlStoragePath) && File.Exists(sale.SunatXmlStoragePath))
        {
            return new ExportedFileDto(await File.ReadAllBytesAsync(sale.SunatXmlStoragePath, cancellationToken), "application/xml", fileName);
        }

        if (string.IsNullOrWhiteSpace(sale.SunatXmlContent))
        {
            throw new InvalidOperationException("No existe XML almacenado para la venta seleccionada.");
        }

        return new ExportedFileDto(Encoding.UTF8.GetBytes(sale.SunatXmlContent), "application/xml", fileName);
    }
}

public sealed class DownloadSaleSunatCdrQueryHandler(ISaleRepository saleRepository)
    : IRequestHandler<DownloadSaleSunatCdrQuery, ExportedFileDto>
{
    public async Task<ExportedFileDto> Handle(DownloadSaleSunatCdrQuery request, CancellationToken cancellationToken)
    {
        var sale = await saleRepository.GetByOrderIdAsync(request.OrderId, cancellationToken)
            ?? throw new InvalidOperationException("No se encontro la venta asociada a la orden indicada.");

        if (sale.SunatStatus != "accepted")
        {
            throw new InvalidOperationException("Solo se puede descargar CDR para comprobantes aceptados por SUNAT.");
        }

        var fileName = string.IsNullOrWhiteSpace(sale.SunatCdrFileName)
            ? $"R-{Path.GetFileNameWithoutExtension(sale.SunatXmlFileName ?? $"sunat-{request.OrderId:N}.xml")}.zip"
            : sale.SunatCdrFileName;

        if (!string.IsNullOrWhiteSpace(sale.SunatCdrStoragePath) && File.Exists(sale.SunatCdrStoragePath))
        {
            return new ExportedFileDto(await File.ReadAllBytesAsync(sale.SunatCdrStoragePath, cancellationToken), "application/zip", fileName);
        }

        if (string.IsNullOrWhiteSpace(sale.SunatCdrContent))
        {
            throw new InvalidOperationException("No existe CDR almacenado para la venta seleccionada.");
        }

        try
        {
            return new ExportedFileDto(Convert.FromBase64String(sale.SunatCdrContent), "application/zip", fileName);
        }
        catch (FormatException)
        {
            throw new InvalidOperationException("El CDR almacenado no tiene un formato valido para descarga.");
        }
    }
}
