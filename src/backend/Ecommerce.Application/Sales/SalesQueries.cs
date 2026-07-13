using Ecommerce.Application.Common;
using MediatR;

namespace Ecommerce.Application.Sales;

public sealed record SearchAdminSalesQuery(SaleAdminSearchRequest Request) : IRequest<SaleAdminSearchResultDto>;

public sealed record ExportAdminSalesExcelQuery(SaleAdminSearchRequest Request) : IRequest<ExportedFileDto>;

public sealed record ExportAdminSalesPdfQuery(SaleAdminSearchRequest Request) : IRequest<ExportedFileDto>;

public sealed class SearchAdminSalesQueryHandler(ISaleRepository saleRepository)
    : IRequestHandler<SearchAdminSalesQuery, SaleAdminSearchResultDto>
{
    public async Task<SaleAdminSearchResultDto> Handle(SearchAdminSalesQuery request, CancellationToken cancellationToken)
    {
        var page = await saleRepository.SearchAdminAsync(request.Request, cancellationToken);
        var items = await saleRepository.ListAdminAsync(request.Request, cancellationToken);
        var summary = SaleAdminProjection.BuildSummary(items);
        var dashboard = SaleAdminProjection.BuildDashboard(items);
        return new SaleAdminSearchResultDto(page, summary, dashboard);
    }
}

public sealed class ExportAdminSalesExcelQueryHandler(ISaleRepository saleRepository, ISalesExportService salesExportService)
    : IRequestHandler<ExportAdminSalesExcelQuery, ExportedFileDto>
{
    public async Task<ExportedFileDto> Handle(ExportAdminSalesExcelQuery request, CancellationToken cancellationToken)
    {
        var items = await saleRepository.ListAdminAsync(request.Request, cancellationToken);
        var summary = SaleAdminProjection.BuildSummary(items);
        var dashboard = SaleAdminProjection.BuildDashboard(items);
        var document = new SalesExportDocumentDto("Reporte de ventas", request.Request.StartDate, request.Request.EndDate, request.Request.Product, summary, dashboard, items);
        return new ExportedFileDto(
            salesExportService.BuildExcel(document),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            SaleAdminProjection.BuildFileName("ventas", "xlsx", request.Request));
    }
}

public sealed class ExportAdminSalesPdfQueryHandler(ISaleRepository saleRepository, ISalesExportService salesExportService)
    : IRequestHandler<ExportAdminSalesPdfQuery, ExportedFileDto>
{
    public async Task<ExportedFileDto> Handle(ExportAdminSalesPdfQuery request, CancellationToken cancellationToken)
    {
        var items = await saleRepository.ListAdminAsync(request.Request, cancellationToken);
        var summary = SaleAdminProjection.BuildSummary(items);
        var dashboard = SaleAdminProjection.BuildDashboard(items);
        var document = new SalesExportDocumentDto("Reporte de ventas", request.Request.StartDate, request.Request.EndDate, request.Request.Product, summary, dashboard, items);
        return new ExportedFileDto(
            salesExportService.BuildPdf(document),
            "application/pdf",
            SaleAdminProjection.BuildFileName("ventas", "pdf", request.Request));
    }
}

internal static class SaleAdminProjection
{
    public static SaleAdminSummaryDto BuildSummary(IReadOnlyList<SaleAdminItemDto> items)
    {
        var totalOrders = items.Select(item => item.OrderId).Distinct().LongCount();
        var totalLines = items.LongCount();
        var unitsSold = items.Sum(item => (long)item.Quantity);
        var grossSales = items.Sum(item => item.LineTotal);
        return new SaleAdminSummaryDto(grossSales, totalOrders, totalLines, unitsSold);
    }

    public static SaleAdminDashboardDto BuildDashboard(IReadOnlyList<SaleAdminItemDto> items)
    {
        var dailySales = items
            .GroupBy(item => DateOnly.FromDateTime(item.SaleDate.DateTime))
            .OrderBy(group => group.Key)
            .Select(group => new SaleDailyPointDto(
                group.Key.ToString("dd/MM"),
                group.Sum(item => item.LineTotal),
                group.Select(item => item.OrderId).Distinct().LongCount(),
                group.Sum(item => (long)item.Quantity)))
            .ToArray();

        var topProducts = items
            .GroupBy(item => new { item.ProductId, item.ProductName, item.Sku })
            .Select(group => new TopSellingProductDto(
                group.Key.ProductId,
                group.Key.ProductName,
                group.Key.Sku,
                group.Sum(item => (long)item.Quantity),
                group.Sum(item => item.LineTotal),
                group.Select(item => item.OrderId).Distinct().LongCount()))
            .OrderByDescending(item => item.UnitsSold)
            .ThenByDescending(item => item.Revenue)
            .Take(10)
            .ToArray();

        return new SaleAdminDashboardDto(dailySales, topProducts);
    }

    public static string BuildFileName(string prefix, string extension, SaleAdminSearchRequest request)
    {
        var start = request.StartDate?.ToString("yyyyMMdd") ?? "inicio";
        var end = request.EndDate?.ToString("yyyyMMdd") ?? "fin";
        return $"{prefix}-{start}-{end}.{extension}";
    }
}