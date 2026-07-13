using System.IO.Compression;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Security.Cryptography.Xml;
using System.Text;
using System.Xml;
using System.Xml.Linq;
using Ecommerce.Application.Common;
using Ecommerce.Domain.Common;
using Ecommerce.Domain.Orders;
using Ecommerce.Domain.Sales;
using Microsoft.Extensions.Logging;

namespace Ecommerce.Infrastructure.Sales;

public sealed class SunatInvoiceService : ISunatInvoiceService
{
    private const string SunatUblVersion = "2.1";
    private const string SunatCustomization = "2.0";
    private readonly ILogger<SunatInvoiceService>? _logger;

    public SunatInvoiceService(ILogger<SunatInvoiceService>? logger = null)
    {
        _logger = logger;
    }

    public async Task<SunatSubmissionResult> SubmitSaleAsync(Sale sale, StoreSettings settings, CancellationToken cancellationToken = default)
    {
        ValidateSettings(settings);

        var documentTypeCode = sale.DocumentType == DocumentType.Invoice ? "01" : "03";
        var series = string.IsNullOrWhiteSpace(sale.SunatSeries)
            ? (sale.DocumentType == DocumentType.Invoice ? "F001" : "B001")
            : sale.SunatSeries.Trim().ToUpperInvariant();
        var correlative = sale.SunatCorrelative.GetValueOrDefault() <= 0 ? 1 : sale.SunatCorrelative.GetValueOrDefault();
        var documentNumber = $"{series}-{correlative:00000000}";
        var xmlFileName = $"{settings.CompanyRuc}-{documentTypeCode}-{documentNumber}.xml";

        var unsignedXml = BuildUblXml(sale, settings, documentNumber, documentTypeCode);
        var signed = SignXml(unsignedXml, settings, xmlFileName, useLegacySha1: false);
        var hasConfiguredEndpoint = !string.IsNullOrWhiteSpace(settings.SunatServiceEndpoint);

        var sunatStorageRoot = Path.Combine(Directory.GetCurrentDirectory(), "storage", "sunat");
        var xmlStorageFolder = Path.Combine(sunatStorageRoot, "xml");
        var cdrStorageFolder = Path.Combine(sunatStorageRoot, "cdr");
        Directory.CreateDirectory(xmlStorageFolder);
        Directory.CreateDirectory(cdrStorageFolder);

        if (IsDevelopment(settings) && !hasConfiguredEndpoint)
        {
            var simulatedCdrXmlFileName = $"R-{xmlFileName}";
            var simulatedCdrContent = BuildSimulatedCdrXml(settings.CompanyRuc, documentNumber);
            var simulatedCdrZipFileName = Path.ChangeExtension(simulatedCdrXmlFileName, ".zip");
            var simulatedCdrZipBytes = ZipXml(simulatedCdrXmlFileName, simulatedCdrContent);

            var xmlStoragePath = Path.Combine(xmlStorageFolder, simulatedCdrXmlFileName);
            File.WriteAllText(xmlStoragePath, simulatedCdrContent, Encoding.UTF8);

            var simulatedCdrPath = Path.Combine(cdrStorageFolder, simulatedCdrZipFileName);
            File.WriteAllBytes(simulatedCdrPath, simulatedCdrZipBytes);

            return new SunatSubmissionResult(
                "accepted",
                "Simulacion desarrollo: no hay endpoint SUNAT configurado.",
                simulatedCdrXmlFileName,
                simulatedCdrContent,
                $"DEV-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}",
                signed.DigestValue,
                AdminDateTime.BusinessNow,
                AdminDateTime.BusinessNow,
                null,
                simulatedCdrZipFileName,
                Convert.ToBase64String(simulatedCdrZipBytes),
                xmlStoragePath,
                simulatedCdrPath);
        }

        if (!hasConfiguredEndpoint)
        {
            throw new InvalidOperationException("Debes configurar el endpoint de SUNAT para modo produccion.");
        }

        _logger?.LogInformation($"[SUNAT] Intento 1: Enviando con perfil SHA256 - {xmlFileName}");
        SaveDebugXml(xmlFileName, signed.SignedXml, "attempt1-sha256");
        var soapResult = await SendToSunatAsync(settings, xmlFileName, signed.SignedXml, cancellationToken);
        var msg1 = (soapResult.Message?.Length ?? 0) > 100 ? soapResult.Message![..100] : soapResult.Message;
        _logger?.LogInformation($"[SUNAT] Respuesta 1: Status={soapResult.Status}, Message={msg1}");

        if (IsIncorrectReferenceDigest(soapResult))
        {
            _logger?.LogWarning($"[SUNAT] Digest mismatch detectado (Client.2335). Reintentando con SHA1...");
            var legacySigned = SignXml(unsignedXml, settings, xmlFileName, useLegacySha1: true);
            SaveDebugXml(xmlFileName, legacySigned.SignedXml, "attempt2-sha1");
            _logger?.LogInformation($"[SUNAT] Intento 2: Enviando con perfil SHA1 - {xmlFileName}");
            var legacyResult = await SendToSunatAsync(settings, xmlFileName, legacySigned.SignedXml, cancellationToken);
            var msg2 = (legacyResult.Message?.Length ?? 0) > 100 ? legacyResult.Message![..100] : legacyResult.Message;
            _logger?.LogInformation($"[SUNAT] Respuesta 2: Status={legacyResult.Status}, Message={msg2}");

            signed = legacySigned;
            soapResult = legacyResult;
        }

        string? xmlStoragePathFromCdr = null;
        if (!string.IsNullOrWhiteSpace(soapResult.CdrXmlFileName) && !string.IsNullOrWhiteSpace(soapResult.CdrXml))
        {
            xmlStoragePathFromCdr = Path.Combine(xmlStorageFolder, soapResult.CdrXmlFileName);
            File.WriteAllText(xmlStoragePathFromCdr, soapResult.CdrXml, Encoding.UTF8);
        }

        string? cdrStoragePath = null;
        if (!string.IsNullOrWhiteSpace(soapResult.CdrZipFileName) && !string.IsNullOrWhiteSpace(soapResult.CdrZipBase64))
        {
            cdrStoragePath = Path.Combine(cdrStorageFolder, soapResult.CdrZipFileName);
            File.WriteAllBytes(cdrStoragePath, Convert.FromBase64String(soapResult.CdrZipBase64));
        }

        return new SunatSubmissionResult(
            soapResult.Status,
            soapResult.Message ?? string.Empty,
            soapResult.CdrXmlFileName ?? xmlFileName,
            soapResult.CdrXml ?? string.Empty,
            soapResult.Ticket,
            signed.DigestValue,
            AdminDateTime.BusinessNow,
            soapResult.Status == "accepted" ? AdminDateTime.BusinessNow : null,
            soapResult.RawResponse,
            soapResult.CdrZipFileName,
            soapResult.CdrZipBase64,
            xmlStoragePathFromCdr,
            cdrStoragePath);
    }

    private static bool IsDevelopment(StoreSettings settings) =>
        string.Equals(settings.SunatEnvironment, "development", StringComparison.OrdinalIgnoreCase);

    private static void ValidateSettings(StoreSettings settings)
    {
        if (string.IsNullOrWhiteSpace(settings.CompanyRuc) || settings.CompanyRuc.Length != 11)
        {
            throw new InvalidOperationException("La empresa debe tener RUC valido (11 digitos) para enviar a SUNAT.");
        }

        if (string.IsNullOrWhiteSpace(settings.CompanyBusinessName))
        {
            throw new InvalidOperationException("Configura la razon social de la empresa antes de enviar a SUNAT.");
        }

        if (string.IsNullOrWhiteSpace(settings.SunatSolUser) || string.IsNullOrWhiteSpace(settings.SunatSolPassword))
        {
            throw new InvalidOperationException("Configura usuario SOL y clave SOL antes de enviar a SUNAT.");
        }

        if (string.IsNullOrWhiteSpace(settings.SunatCertificateBase64) || string.IsNullOrWhiteSpace(settings.SunatCertificatePassword))
        {
            throw new InvalidOperationException("Configura certificado digital y su clave antes de enviar a SUNAT.");
        }
    }

    private static XDocument BuildUblXml(Sale sale, StoreSettings settings, string documentNumber, string documentTypeCode)
    {
        var issue = TimeZoneInfo.ConvertTime(sale.SaleDate, AdminDateTime.BusinessTimeZone);
        var currency = "PEN";

        XNamespace nsInvoice = "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2";
        XNamespace nsCac = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";
        XNamespace nsCbc = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";
        XNamespace nsExt = "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2";
        XNamespace nsDs = "http://www.w3.org/2000/09/xmldsig#";
        var (taxSchemeId, taxSchemeName, taxTypeCode, taxExemptionReasonCode) = ResolveTaxScheme(sale.TaxType);

        var legalMonetaryTotal = sale.Total;
        var groupedTaxSubtotals = sale.Items
            .GroupBy(item => new
            {
                TaxSchemeId = string.IsNullOrWhiteSpace(item.TaxSchemeId) ? taxSchemeId : item.TaxSchemeId,
                TaxSchemeName = string.IsNullOrWhiteSpace(item.TaxSchemeName) ? taxSchemeName : item.TaxSchemeName,
                TaxTypeCode = string.IsNullOrWhiteSpace(item.TaxTypeCode) ? taxTypeCode : item.TaxTypeCode,
                TaxAffectationCode = string.IsNullOrWhiteSpace(item.TaxAffectationCode) ? taxExemptionReasonCode : item.TaxAffectationCode,
                TaxRate = item.TaxRate > 0 ? item.TaxRate : sale.TaxRate
            })
            .Select(group => new
            {
                group.Key.TaxSchemeId,
                group.Key.TaxSchemeName,
                group.Key.TaxTypeCode,
                group.Key.TaxAffectationCode,
                group.Key.TaxRate,
                TaxableAmount = Math.Round(group.Sum(item => item.LineAmountWithoutTax > 0 ? item.LineAmountWithoutTax : item.Subtotal), 2, MidpointRounding.AwayFromZero),
                TaxAmount = Math.Round(group.Sum(item => item.TaxAmount > 0 ? item.TaxAmount : item.Tax), 2, MidpointRounding.AwayFromZero)
            })
            .ToArray();

        var taxSubtotalElements = groupedTaxSubtotals.Select(group =>
        {
            return new XElement(nsCac + "TaxSubtotal",
                new XElement(nsCbc + "TaxableAmount", new XAttribute("currencyID", currency), group.TaxableAmount.ToString("0.00")),
                new XElement(nsCbc + "TaxAmount", new XAttribute("currencyID", currency), group.TaxAmount.ToString("0.00")),
                new XElement(nsCac + "TaxCategory",
                    new XElement(nsCbc + "Percent", group.TaxRate.ToString("0.00")),
                    new XElement(nsCbc + "TaxExemptionReasonCode", group.TaxAffectationCode),
                    new XElement(nsCac + "TaxScheme",
                        new XElement(nsCbc + "ID", group.TaxSchemeId),
                        new XElement(nsCbc + "Name", group.TaxSchemeName),
                        new XElement(nsCbc + "TaxTypeCode", group.TaxTypeCode))));
        }).ToArray();

        var invoiceLines = sale.Items.Select((item, index) =>
        {
            var lineAmountWithoutTax = item.LineAmountWithoutTax > 0 ? item.LineAmountWithoutTax : item.Subtotal;
            var lineTaxAmount = item.TaxAmount > 0 ? item.TaxAmount : item.Tax;
            var unitPriceWithTax = item.UnitPriceWithTax > 0 ? item.UnitPriceWithTax : item.Price;
            var lineTaxRate = item.TaxRate > 0 ? item.TaxRate : sale.TaxRate;
            var lineTaxIncludedInPrice = item.TaxIncludedInPrice || sale.TaxIncludedInPrice;
            var unitPriceWithoutTax = item.UnitPriceWithoutTax > 0
                ? item.UnitPriceWithoutTax
                : CalculateTaxableAmount(unitPriceWithTax, lineTaxRate, lineTaxIncludedInPrice);
            var (lineTaxSchemeId, lineTaxSchemeName, lineTaxTypeCode, lineTaxAffectationCode) = ResolveTaxScheme(item.TaxType);

            if (!string.IsNullOrWhiteSpace(item.TaxSchemeId)) lineTaxSchemeId = item.TaxSchemeId;
            if (!string.IsNullOrWhiteSpace(item.TaxSchemeName)) lineTaxSchemeName = item.TaxSchemeName;
            if (!string.IsNullOrWhiteSpace(item.TaxTypeCode)) lineTaxTypeCode = item.TaxTypeCode;
            if (!string.IsNullOrWhiteSpace(item.TaxAffectationCode)) lineTaxAffectationCode = item.TaxAffectationCode;

            return new XElement(nsCac + "InvoiceLine",
                new XElement(nsCbc + "ID", index + 1),
                new XElement(nsCbc + "InvoicedQuantity", new XAttribute("unitCode", "NIU"), item.Quantity),
                new XElement(nsCbc + "LineExtensionAmount", new XAttribute("currencyID", currency), lineAmountWithoutTax.ToString("0.00")),
                new XElement(nsCac + "PricingReference",
                    new XElement(nsCac + "AlternativeConditionPrice",
                        new XElement(nsCbc + "PriceAmount", new XAttribute("currencyID", currency), unitPriceWithTax.ToString("0.00")),
                        new XElement(nsCbc + "PriceTypeCode", "01"))),
                new XElement(nsCac + "TaxTotal",
                    new XElement(nsCbc + "TaxAmount", new XAttribute("currencyID", currency), lineTaxAmount.ToString("0.00")),
                    new XElement(nsCac + "TaxSubtotal",
                        new XElement(nsCbc + "TaxableAmount", new XAttribute("currencyID", currency), lineAmountWithoutTax.ToString("0.00")),
                        new XElement(nsCbc + "TaxAmount", new XAttribute("currencyID", currency), lineTaxAmount.ToString("0.00")),
                        new XElement(nsCac + "TaxCategory",
                            new XElement(nsCbc + "Percent", lineTaxRate.ToString("0.00")),
                            new XElement(nsCbc + "TaxExemptionReasonCode", lineTaxAffectationCode),
                            new XElement(nsCac + "TaxScheme",
                                new XElement(nsCbc + "ID", lineTaxSchemeId),
                                new XElement(nsCbc + "Name", lineTaxSchemeName),
                                new XElement(nsCbc + "TaxTypeCode", lineTaxTypeCode))))),
                new XElement(nsCac + "Item",
                    new XElement(nsCbc + "Description", item.ProductName)),
                new XElement(nsCac + "Price",
                    new XElement(nsCbc + "PriceAmount", new XAttribute("currencyID", currency), unitPriceWithoutTax.ToString("0.00"))));
        });

        var invoice = new XDocument(
            new XDeclaration("1.0", "UTF-8", null),
            new XElement(nsInvoice + "Invoice",
                new XAttribute(XNamespace.Xmlns + "cac", nsCac),
                new XAttribute(XNamespace.Xmlns + "cbc", nsCbc),
                new XAttribute(XNamespace.Xmlns + "ext", nsExt),
                new XAttribute(XNamespace.Xmlns + "ds", nsDs),
                new XElement(nsExt + "UBLExtensions",
                    new XElement(nsExt + "UBLExtension",
                        new XElement(nsExt + "ExtensionContent",
                            new XElement(nsDs + "Signature", new XAttribute("Id", "SignatureSP"))))),
                new XElement(nsCbc + "UBLVersionID", SunatUblVersion),
                new XElement(nsCbc + "CustomizationID", SunatCustomization),
                new XElement(nsCbc + "ID", documentNumber),
                new XElement(nsCbc + "IssueDate", issue.ToString("yyyy-MM-dd")),
                new XElement(nsCbc + "IssueTime", issue.ToString("HH:mm:ss")),
                new XElement(nsCbc + "InvoiceTypeCode", new XAttribute("listID", "0101"), documentTypeCode),
                new XElement(nsCbc + "DocumentCurrencyCode", currency),
                new XElement(nsCac + "Signature",
                    new XElement(nsCbc + "ID", settings.CompanyRuc),
                    new XElement(nsCac + "SignatoryParty",
                        new XElement(nsCac + "PartyIdentification",
                            new XElement(nsCbc + "ID", settings.CompanyRuc)),
                        new XElement(nsCac + "PartyName",
                            new XElement(nsCbc + "Name", settings.CompanyBusinessName))),
                    new XElement(nsCac + "DigitalSignatureAttachment",
                        new XElement(nsCac + "ExternalReference",
                            new XElement(nsCbc + "URI", "#SignatureSP")))),
                new XElement(nsCac + "AccountingSupplierParty",
                    new XElement(nsCac + "Party",
                        new XElement(nsCac + "PartyIdentification",
                            new XElement(nsCbc + "ID",
                                new XAttribute("schemeID", "6"),
                                settings.CompanyRuc)),
                        new XElement(nsCac + "PartyName",
                            new XElement(nsCbc + "Name", settings.CompanyBusinessName)),
                        new XElement(nsCac + "PartyLegalEntity",
                            new XElement(nsCbc + "RegistrationName", settings.CompanyBusinessName),
                            new XElement(nsCac + "RegistrationAddress",
                                new XElement(nsCbc + "ID", "150101"),
                                new XElement(nsCbc + "AddressTypeCode", string.IsNullOrWhiteSpace(settings.SunatEstablishmentCode) ? "0000" : settings.SunatEstablishmentCode.Trim()),
                                new XElement(nsCac + "AddressLine",
                                    new XElement(nsCbc + "Line", string.IsNullOrWhiteSpace(settings.CompanyAddress) ? "DIRECCION NO ESPECIFICADA" : settings.CompanyAddress.Trim())),
                                new XElement(nsCac + "Country",
                                    new XElement(nsCbc + "IdentificationCode", "PE")))))),
                new XElement(nsCac + "AccountingCustomerParty",
                    new XElement(nsCac + "Party",
                        new XElement(nsCac + "PartyIdentification",
                            new XElement(nsCbc + "ID",
                                new XAttribute("schemeID", ResolveCustomerSchemeId(sale.CustomerDocumentType, sale.DocumentNumber)),
                                sale.DocumentNumber ?? "00000000")),
                        new XElement(nsCac + "PartyLegalEntity",
                            new XElement(nsCbc + "RegistrationName", sale.CustomerName)))),
                new XElement(nsCac + "TaxTotal",
                    new XElement(nsCbc + "TaxAmount", new XAttribute("currencyID", currency), sale.Tax.ToString("0.00")),
                    taxSubtotalElements),
                new XElement(nsCac + "LegalMonetaryTotal",
                    new XElement(nsCbc + "LineExtensionAmount", new XAttribute("currencyID", currency), sale.Subtotal.ToString("0.00")),
                    new XElement(nsCbc + "TaxInclusiveAmount", new XAttribute("currencyID", currency), legalMonetaryTotal.ToString("0.00")),
                    new XElement(nsCbc + "PayableAmount", new XAttribute("currencyID", currency), legalMonetaryTotal.ToString("0.00"))),
                invoiceLines));

        return invoice;
    }

    private static decimal CalculateTaxableAmount(decimal grossAmount, decimal taxRate, bool taxIncludedInPrice)
    {
        if (!taxIncludedInPrice || taxRate <= 0)
        {
            return Math.Round(grossAmount, 2, MidpointRounding.AwayFromZero);
        }

        var taxable = grossAmount / (1m + (taxRate / 100m));
        return Math.Round(taxable, 2, MidpointRounding.AwayFromZero);
    }

    private static (string TaxSchemeId, string TaxSchemeName, string TaxTypeCode, string TaxExemptionReasonCode) ResolveTaxScheme(string? taxType)
    {
        if (string.Equals(taxType, "IVA", StringComparison.OrdinalIgnoreCase))
        {
            return ("1000", "IVA", "VAT", "10");
        }

        return ("1000", "IGV", "VAT", "10");
    }

    private static string ResolveCustomerSchemeId(CustomerDocumentType customerDocumentType, string? documentNumber)
    {
        if (string.IsNullOrWhiteSpace(documentNumber))
        {
            return "0";
        }

        return customerDocumentType switch
        {
            CustomerDocumentType.Dni => "1",
            CustomerDocumentType.Ruc => "6",
            CustomerDocumentType.ForeignerCard => "4",
            CustomerDocumentType.Passport => "7",
            CustomerDocumentType.NoDomiciledTaxId => "0",
            _ => "0"
        };
    }

    private static (string SignedXml, string? DigestValue) SignXml(XDocument unsignedXml, StoreSettings settings, string xmlFileName, bool useLegacySha1)
    {
        var certificateBytes = Convert.FromBase64String(settings.SunatCertificateBase64!);
        using var cert = new X509Certificate2(
            certificateBytes,
            settings.SunatCertificatePassword,
            X509KeyStorageFlags.Exportable | X509KeyStorageFlags.EphemeralKeySet);

        if (!cert.HasPrivateKey)
        {
            throw new InvalidOperationException("El certificado PFX configurado no contiene una clave privada.");
        }

        var xmlDoc = new XmlDocument { PreserveWhitespace = true };
        using (var reader = unsignedXml.CreateReader())
        {
            xmlDoc.Load(reader);
        }

        // Buscar el nodo Signature vacio de UBLExtensions y quitarlo temporalmente
        var signatureNode = xmlDoc.GetElementsByTagName("Signature", "http://www.w3.org/2000/09/xmldsig#").Cast<XmlElement>().FirstOrDefault();
        var signatureParent = signatureNode?.ParentNode;
        if (signatureNode is not null && signatureParent is not null)
        {
            signatureParent.RemoveChild(signatureNode);
        }

        var signingKey = cert.GetRSAPrivateKey()
            ?? throw new InvalidOperationException("El certificado digital no contiene una clave privada RSA valida.");

        var signedXml = new SignedXml(xmlDoc)
        {
            SigningKey = signingKey
        };

        var signedInfo = signedXml.SignedInfo
            ?? throw new InvalidOperationException($"No se pudo inicializar SignedInfo para firmar el XML {xmlFileName}.");

        signedInfo.CanonicalizationMethod = SignedXml.XmlDsigCanonicalizationUrl;
        signedInfo.SignatureMethod = useLegacySha1 ? SignedXml.XmlDsigRSASHA1Url : SignedXml.XmlDsigRSASHA256Url;

        // Referencia al documento completo CON la transformada Enveloped (para quitar la firma al validar)
        var reference = new Reference("")
        {
            DigestMethod = useLegacySha1 ? SignedXml.XmlDsigSHA1Url : SignedXml.XmlDsigSHA256Url
        };
        reference.AddTransform(new XmlDsigEnvelopedSignatureTransform());
        reference.AddTransform(new XmlDsigC14NTransform());
        signedXml.AddReference(reference);

        var keyInfo = new KeyInfo();
        keyInfo.AddClause(new KeyInfoX509Data(cert));
        signedXml.KeyInfo = keyInfo;

        signedXml.ComputeSignature();

        var digestValue = reference.DigestValue is null ? null : Convert.ToBase64String(reference.DigestValue);
        var xmlSignatureElement = signedXml.GetXml();
        xmlSignatureElement.SetAttribute("Id", "SignatureSP");

        // Insertar la firma generada en el lugar donde estaba el placeholder
        if (signatureParent is not null)
        {
            signatureParent.AppendChild(xmlDoc.ImportNode(xmlSignatureElement, true));
        }

        return (xmlDoc.OuterXml, digestValue);
    }

    private static bool IsIncorrectReferenceDigest((string Status, string Message, string? Ticket, string? RawResponse, string? CdrXmlFileName, string? CdrXml, string? CdrZipFileName, string? CdrZipBase64) soapResult)
    {
        var message = soapResult.Message ?? string.Empty;
        var raw = soapResult.RawResponse ?? string.Empty;
        return message.Contains("Incorrect reference digest", StringComparison.OrdinalIgnoreCase)
               || message.Contains("Client.2335", StringComparison.OrdinalIgnoreCase)
               || message.Contains("digest", StringComparison.OrdinalIgnoreCase)
               || raw.Contains("Incorrect reference digest", StringComparison.OrdinalIgnoreCase)
               || raw.Contains("Client.2335", StringComparison.OrdinalIgnoreCase);
    }

    private void SaveDebugXml(string xmlFileName, string xmlContent, string suffix)
    {
        try
        {
            var debugDir = Path.Combine(Directory.GetCurrentDirectory(), "storage", "sunat-debug");
            Directory.CreateDirectory(debugDir);
            var debugPath = Path.Combine(debugDir, $"{Path.GetFileNameWithoutExtension(xmlFileName)}-{suffix}-{DateTime.UtcNow:yyyyMMddHHmmss}.xml");
            File.WriteAllText(debugPath, xmlContent, Encoding.UTF8);
        }
        catch (Exception ex)
        {
            _logger?.LogError($"[SUNAT] Error guardando debug XML: {ex.Message}");
        }
    }

    private static async Task<(string Status, string Message, string? Ticket, string? RawResponse, string? CdrXmlFileName, string? CdrXml, string? CdrZipFileName, string? CdrZipBase64)> SendToSunatAsync(StoreSettings settings, string xmlFileName, string signedXml, CancellationToken cancellationToken)
    {
        var zippedXml = ZipXml(xmlFileName, signedXml);
        var zipFileName = xmlFileName.Replace(".xml", ".zip", StringComparison.OrdinalIgnoreCase);
        var zipBase64 = Convert.ToBase64String(zippedXml);
        var username = $"{settings.CompanyRuc}{settings.SunatSolUser}";

        var soapEnvelope = $"<?xml version=\"1.0\" encoding=\"utf-8\"?>\n" +
                           "<soapenv:Envelope xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\" xmlns:ser=\"http://service.sunat.gob.pe\" xmlns:wsse=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd\">" +
                           "<soapenv:Header>" +
                           "<wsse:Security>" +
                           "<wsse:UsernameToken>" +
                           $"<wsse:Username>{System.Security.SecurityElement.Escape(username)}</wsse:Username>" +
                           $"<wsse:Password>{System.Security.SecurityElement.Escape(settings.SunatSolPassword)}</wsse:Password>" +
                           "</wsse:UsernameToken>" +
                           "</wsse:Security>" +
                           "</soapenv:Header>" +
                           "<soapenv:Body>" +
                           "<ser:sendBill>" +
                           $"<fileName>{zipFileName}</fileName>" +
                           $"<contentFile>{zipBase64}</contentFile>" +
                           "</ser:sendBill>" +
                           "</soapenv:Body>" +
                           "</soapenv:Envelope>";

        using var httpClient = new HttpClient();
        using var content = new StringContent(soapEnvelope, Encoding.UTF8, "text/xml");
        content.Headers.Add("SOAPAction", "\"sendBill\"");

        using var response = await httpClient.PostAsync(settings.SunatServiceEndpoint, content, cancellationToken);
        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            return ("error", TrimMessage(responseBody), null, responseBody, null, null, null, null);
        }

        if (responseBody.Contains("faultstring", StringComparison.OrdinalIgnoreCase))
        {
            var fault = TryReadFirstByTag(responseBody, "faultstring") ?? TrimMessage(responseBody);
            return ("rejected", TrimMessage(fault), null, responseBody, null, null, null, null);
        }

        var applicationResponse = TryReadFirstByTag(responseBody, "applicationResponse");
        if (string.IsNullOrWhiteSpace(applicationResponse))
        {
            return ("sent", TrimMessage(responseBody), null, responseBody, null, null, null, null);
        }

        try
        {
            var cdrZip = Convert.FromBase64String(applicationResponse);
            var (cdrXmlFileName, cdrXml) = ExtractFirstXmlFromZip(cdrZip);
            var cdrZipFileName = Path.ChangeExtension(cdrXmlFileName, ".zip");
            var responseCode = TryReadFirstByLocalName(cdrXml, "ResponseCode");
            var description = TryReadFirstByLocalName(cdrXml, "Description") ?? string.Empty;
            var normalizedDescription = description.ToUpperInvariant();

            if (responseCode == "0")
            {
                return ("accepted", TrimMessage(description), null, responseBody, cdrXmlFileName, cdrXml, cdrZipFileName, applicationResponse);
            }

            if (normalizedDescription.Contains("OBSERV"))
            {
                return ("observed", TrimMessage(description), null, responseBody, cdrXmlFileName, cdrXml, cdrZipFileName, applicationResponse);
            }

            return ("rejected", TrimMessage(description), null, responseBody, cdrXmlFileName, cdrXml, cdrZipFileName, applicationResponse);
        }
        catch
        {
            return ("sent", TrimMessage(responseBody), null, responseBody, null, null, null, null);
        }
    }

    private static byte[] ZipXml(string xmlFileName, string signedXml)
    {
        using var stream = new MemoryStream();
        using (var archive = new ZipArchive(stream, ZipArchiveMode.Create, true))
        {
            var entry = archive.CreateEntry(xmlFileName, CompressionLevel.Optimal);
            using var entryStream = entry.Open();
            var bytes = Encoding.UTF8.GetBytes(signedXml);
            entryStream.Write(bytes, 0, bytes.Length);
        }

        return stream.ToArray();
    }

    private static (string FileName, string XmlContent) ExtractFirstXmlFromZip(byte[] zipBytes)
    {
        using var stream = new MemoryStream(zipBytes);
        using var archive = new ZipArchive(stream, ZipArchiveMode.Read);
        var entry = archive.Entries.FirstOrDefault(current => current.FullName.EndsWith(".xml", StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException("SUNAT no devolvio un XML dentro del ZIP CDR.");

        using var entryStream = entry.Open();
        using var reader = new StreamReader(entryStream, Encoding.UTF8);
        return (Path.GetFileName(entry.FullName), reader.ReadToEnd());
    }

    private static string BuildSimulatedCdrXml(string companyRuc, string documentNumber)
    {
        return $"<?xml version=\"1.0\" encoding=\"UTF-8\"?><ApplicationResponse><DocumentResponse><Response><ReferenceID>{companyRuc}-{documentNumber}</ReferenceID><ResponseCode>0</ResponseCode><Description>Simulacion desarrollo sin endpoint SUNAT</Description></Response></DocumentResponse></ApplicationResponse>";
    }

    private static string? TryReadFirstByTag(string xml, string tagName)
    {
        var doc = new XmlDocument();
        doc.LoadXml(xml);
        return doc.GetElementsByTagName(tagName).Cast<XmlNode>().FirstOrDefault()?.InnerText;
    }

    private static string? TryReadFirstByLocalName(string xml, string localName)
    {
        var doc = new XmlDocument();
        doc.LoadXml(xml);
        return doc.SelectNodes($"//*[local-name()='{localName}']")?.Cast<XmlNode>().FirstOrDefault()?.InnerText;
    }

    private static string TrimMessage(string value)
    {
        if (string.IsNullOrWhiteSpace(value)) return value;
        return value.Length <= 520 ? value : value[..520];
     }
 }
