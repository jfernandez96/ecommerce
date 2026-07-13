using ClosedXML.Excel;
using Ecommerce.Application.Common;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Ecommerce.Infrastructure.Sales;

public sealed class SalesExportService : ISalesExportService
{
    public byte[] BuildExcel(SalesExportDocumentDto document)
    {
        using var workbook = new XLWorkbook();

        var summarySheet = workbook.Worksheets.Add("Resumen");
        summarySheet.Cell(1, 1).Value = document.Title;
        summarySheet.Cell(3, 1).Value = "Venta bruta";
        summarySheet.Cell(3, 2).Value = document.Summary.GrossSales;
        summarySheet.Cell(4, 1).Value = "Ordenes";
        summarySheet.Cell(4, 2).Value = document.Summary.TotalOrders;
        summarySheet.Cell(5, 1).Value = "Lineas";
        summarySheet.Cell(5, 2).Value = document.Summary.TotalLines;
        summarySheet.Cell(6, 1).Value = "Unidades";
        summarySheet.Cell(6, 2).Value = document.Summary.UnitsSold;
        summarySheet.Cell(8, 1).Value = "Fecha";
        summarySheet.Cell(8, 2).Value = "Venta";
        summarySheet.Cell(8, 3).Value = "Ordenes";
        summarySheet.Cell(8, 4).Value = "Unidades";

        var summaryRow = 9;
        foreach (var point in document.Dashboard.DailySales)
        {
            summarySheet.Cell(summaryRow, 1).Value = point.DateLabel;
            summarySheet.Cell(summaryRow, 2).Value = point.GrossSales;
            summarySheet.Cell(summaryRow, 3).Value = point.Orders;
            summarySheet.Cell(summaryRow, 4).Value = point.UnitsSold;
            summaryRow++;
        }

        var topSheet = workbook.Worksheets.Add("TopProductos");
        topSheet.Cell(1, 1).Value = "Producto";
        topSheet.Cell(1, 2).Value = "SKU";
        topSheet.Cell(1, 3).Value = "Unidades";
        topSheet.Cell(1, 4).Value = "Ingresos";
        topSheet.Cell(1, 5).Value = "Ordenes";
        var topRow = 2;
        foreach (var product in document.Dashboard.TopProducts)
        {
            topSheet.Cell(topRow, 1).Value = product.ProductName;
            topSheet.Cell(topRow, 2).Value = product.Sku;
            topSheet.Cell(topRow, 3).Value = product.UnitsSold;
            topSheet.Cell(topRow, 4).Value = product.Revenue;
            topSheet.Cell(topRow, 5).Value = product.Orders;
            topRow++;
        }

        var detailSheet = workbook.Worksheets.Add("Detalle");
        var headers = new[] { "FechaVenta", "Orden", "Serie", "Correlativo", "Cliente", "Correo", "Producto", "SKU", "Variante", "Cantidad", "PrecioUnitario", "TotalLinea", "TotalOrden", "MetodoPago", "EstadoPago" };
        for (var index = 0; index < headers.Length; index++)
        {
            detailSheet.Cell(1, index + 1).Value = headers[index];
        }

        var detailRow = 2;
        foreach (var item in document.Items)
        {
            detailSheet.Cell(detailRow, 1).Value = item.SaleDate.LocalDateTime;
            detailSheet.Cell(detailRow, 2).Value = item.OrderNumber;
            detailSheet.Cell(detailRow, 3).Value = item.SunatSeries;
            detailSheet.Cell(detailRow, 4).Value = item.SunatCorrelative;
            detailSheet.Cell(detailRow, 5).Value = item.CustomerName;
            detailSheet.Cell(detailRow, 6).Value = item.CustomerEmail;
            detailSheet.Cell(detailRow, 7).Value = item.ProductName;
            detailSheet.Cell(detailRow, 8).Value = item.Sku;
            detailSheet.Cell(detailRow, 9).Value = item.VariantLabel;
            detailSheet.Cell(detailRow, 10).Value = item.Quantity;
            detailSheet.Cell(detailRow, 11).Value = item.UnitPrice;
            detailSheet.Cell(detailRow, 12).Value = item.LineTotal;
            detailSheet.Cell(detailRow, 13).Value = item.OrderTotal;
            detailSheet.Cell(detailRow, 14).Value = item.PaymentMethod;
            detailSheet.Cell(detailRow, 15).Value = item.PaymentStatus;
            detailRow++;
        }

        foreach (var sheet in workbook.Worksheets)
        {
            sheet.Columns().AdjustToContents();
        }

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    public byte[] BuildPdf(SalesExportDocumentDto document)
    {
        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Margin(24);
                page.Size(PageSizes.A4.Landscape());
                page.DefaultTextStyle(x => x.FontSize(9));

                page.Header().Column(column =>
                {
                    column.Item().Text(document.Title).FontSize(18).Bold();
                    column.Item().Text(BuildFilterLabel(document)).FontColor(Colors.Grey.Darken1);
                });

                page.Content().Column(column =>
                {
                    column.Spacing(12);

                    column.Item().Row(row =>
                    {
                        row.RelativeItem().Element(card => BuildMetricCard(card, "Venta bruta", document.Summary.GrossSales.ToString("C2")));
                        row.RelativeItem().Element(card => BuildMetricCard(card, "Ordenes", document.Summary.TotalOrders.ToString()));
                        row.RelativeItem().Element(card => BuildMetricCard(card, "Lineas", document.Summary.TotalLines.ToString()));
                        row.RelativeItem().Element(card => BuildMetricCard(card, "Unidades", document.Summary.UnitsSold.ToString()));
                    });

                    column.Item().Text("Top productos").Bold().FontSize(12);
                    column.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(3);
                            columns.RelativeColumn(2);
                            columns.RelativeColumn(1);
                            columns.RelativeColumn(1);
                            columns.RelativeColumn(1);
                        });

                        table.Header(header =>
                        {
                            header.Cell().Text("Producto").Bold();
                            header.Cell().Text("SKU").Bold();
                            header.Cell().Text("Unidades").Bold();
                            header.Cell().Text("Ingresos").Bold();
                            header.Cell().Text("Ordenes").Bold();
                        });

                        foreach (var product in document.Dashboard.TopProducts)
                        {
                            table.Cell().Text(product.ProductName);
                            table.Cell().Text(product.Sku);
                            table.Cell().Text(product.UnitsSold.ToString());
                            table.Cell().Text(product.Revenue.ToString("C2"));
                            table.Cell().Text(product.Orders.ToString());
                        }
                    });

                    column.Item().Text("Detalle de ventas").Bold().FontSize(12);
                    column.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(1.4f);
                            columns.RelativeColumn(1.2f);
                            columns.RelativeColumn(0.9f);
                            columns.RelativeColumn(0.9f);
                            columns.RelativeColumn(2.2f);
                            columns.RelativeColumn(2.4f);
                            columns.RelativeColumn(1.2f);
                            columns.RelativeColumn(1f);
                            columns.RelativeColumn(1.2f);
                            columns.RelativeColumn(1.2f);
                        });

                        table.Header(header =>
                        {
                            header.Cell().Text("Fecha").Bold();
                            header.Cell().Text("Orden").Bold();
                            header.Cell().Text("Serie").Bold();
                            header.Cell().Text("Corr.").Bold();
                            header.Cell().Text("Cliente").Bold();
                            header.Cell().Text("Producto").Bold();
                            header.Cell().Text("SKU/Variante").Bold();
                            header.Cell().AlignRight().Text("Cant.").Bold();
                            header.Cell().AlignRight().Text("P.Unit").Bold();
                            header.Cell().AlignRight().Text("T.Linea").Bold();
                            header.Cell().AlignRight().Text("T.Orden").Bold();
                        });

                        foreach (var item in document.Items)
                        {
                            table.Cell().Text(item.SaleDate.ToLocalTime().ToString("dd/MM/yyyy HH:mm"));
                            table.Cell().Text(item.OrderNumber);
                            table.Cell().Text(item.SunatSeries ?? "-");
                            table.Cell().Text(item.SunatCorrelative?.ToString() ?? "-");
                            table.Cell().Text($"{item.CustomerName}\n{item.CustomerEmail}");
                            table.Cell().Text(item.ProductName);
                            table.Cell().Text(string.IsNullOrWhiteSpace(item.VariantLabel) ? item.Sku : $"{item.Sku}\n{item.VariantLabel}");
                            table.Cell().AlignRight().Text(item.Quantity.ToString());
                            table.Cell().AlignRight().Text(item.UnitPrice.ToString("C2"));
                            table.Cell().AlignRight().Text(item.LineTotal.ToString("C2"));
                            table.Cell().AlignRight().Text(item.OrderTotal.ToString("C2"));
                        }
                    });
                });

                page.Footer().AlignRight().Text(text =>
                {
                    text.Span("Pagina ");
                    text.CurrentPageNumber();
                    text.Span(" de ");
                    text.TotalPages();
                });
            });
        }).GeneratePdf();
    }

    private static string BuildFilterLabel(SalesExportDocumentDto document)
    {
        var parts = new List<string>();
        if (document.StartDate.HasValue || document.EndDate.HasValue)
        {
            parts.Add($"Rango: {document.StartDate?.ToString("dd/MM/yyyy") ?? "Inicio"} - {document.EndDate?.ToString("dd/MM/yyyy") ?? "Hoy"}");
        }

        if (!string.IsNullOrWhiteSpace(document.ProductFilter))
        {
            parts.Add($"Producto: {document.ProductFilter}");
        }

        return parts.Count == 0 ? "Sin filtros adicionales" : string.Join(" | ", parts);
    }

    private static void BuildMetricCard(IContainer container, string title, string value)
    {
        container.Border(1).BorderColor(Colors.Grey.Lighten2).Padding(10).Column(column =>
        {
            column.Item().Text(title).FontColor(Colors.Grey.Darken1);
            column.Item().Text(value).FontSize(16).Bold();
        });
    }
}