using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Ecommerce.Application.Common;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Ecommerce.Infrastructure.Security;

public sealed class IntegrationClientSecurityService(IConfiguration configuration) : IIntegrationClientSecurityService
{
    private const string SectionPath = "Integrations:Clients";
    private static readonly TimeSpan Window = TimeSpan.FromMinutes(1);
    private static readonly ConcurrentDictionary<string, RateWindowCounter> Counters = new(StringComparer.OrdinalIgnoreCase);

    public Task<IntegrationClientAccessResult> AuthorizeAsync(string? clientId, string? apiKey, string scope, CancellationToken cancellationToken = default)
    {
        _ = cancellationToken;
        var normalizedClientId = (clientId ?? string.Empty).Trim();
        var normalizedApiKey = (apiKey ?? string.Empty).Trim();

        if (string.IsNullOrWhiteSpace(normalizedClientId) || string.IsNullOrWhiteSpace(normalizedApiKey))
        {
            return Task.FromResult(new IntegrationClientAccessResult(false, null, null, "missing_credentials", "Falta X-Integration-Client o X-Api-Key."));
        }

        var clients = configuration.GetSection(SectionPath)
            .GetChildren()
            .Select(child => new IntegrationClientConfig
            {
                ClientId = child["ClientId"] ?? string.Empty,
                ApiKey = child["ApiKey"] ?? string.Empty,
                Enabled = bool.TryParse(child["Enabled"], out var enabled) && enabled,
                MaxRequestsPerMinute = int.TryParse(child["MaxRequestsPerMinute"], out var limit) ? limit : 30,
                Scopes = child.GetSection("Scopes").GetChildren().Select(scope => scope.Value ?? string.Empty).Where(scope => !string.IsNullOrWhiteSpace(scope)).ToArray()
            })
            .ToList();
        var client = clients.FirstOrDefault(item =>
            item.Enabled
            && item.ClientId.Equals(normalizedClientId, StringComparison.OrdinalIgnoreCase));

        if (client is null)
        {
            return Task.FromResult(new IntegrationClientAccessResult(false, normalizedClientId, null, "invalid_client", "Cliente de integracion no valido o deshabilitado."));
        }

        if (!client.Scopes.Contains(scope, StringComparer.OrdinalIgnoreCase))
        {
            return Task.FromResult(new IntegrationClientAccessResult(false, normalizedClientId, null, "scope_denied", "El cliente no tiene acceso a este scope."));
        }

        if (!SecureEquals(normalizedApiKey, client.ApiKey))
        {
            return Task.FromResult(new IntegrationClientAccessResult(false, normalizedClientId, null, "invalid_api_key", "API key invalida."));
        }

        var now = DateTimeOffset.UtcNow;
        var counter = Counters.GetOrAdd(normalizedClientId, _ => new RateWindowCounter(now, 0));

        lock (counter.Lock)
        {
            if (now - counter.WindowStart >= Window)
            {
                counter.WindowStart = now;
                counter.Count = 0;
            }

            if (counter.Count >= Math.Max(1, client.MaxRequestsPerMinute))
            {
                var retryAfter = Math.Max(1, (int)Math.Ceiling((counter.WindowStart + Window - now).TotalSeconds));
                return Task.FromResult(new IntegrationClientAccessResult(false, normalizedClientId, retryAfter, "rate_limited", "Rate limit excedido para el cliente."));
            }

            counter.Count++;
        }

        return Task.FromResult(new IntegrationClientAccessResult(true, normalizedClientId, null, "ok", "Acceso autorizado."));
    }

    private static bool SecureEquals(string left, string right)
    {
        var leftBytes = Encoding.UTF8.GetBytes(left ?? string.Empty);
        var rightBytes = Encoding.UTF8.GetBytes(right ?? string.Empty);
        return CryptographicOperations.FixedTimeEquals(leftBytes, rightBytes);
    }

    private sealed class RateWindowCounter(DateTimeOffset windowStart, int count)
    {
        public object Lock { get; } = new();
        public DateTimeOffset WindowStart { get; set; } = windowStart;
        public int Count { get; set; } = count;
    }

    private sealed class IntegrationClientConfig
    {
        public string ClientId { get; set; } = string.Empty;
        public string ApiKey { get; set; } = string.Empty;
        public bool Enabled { get; set; }
        public int MaxRequestsPerMinute { get; set; } = 30;
        public string[] Scopes { get; set; } = [];
    }
}

public sealed class FileIntegrationAuditService(ILogger<FileIntegrationAuditService> logger) : IIntegrationAuditService
{
    private static readonly SemaphoreSlim FileLock = new(1, 1);

    public async Task WriteAsync(IntegrationAuditEntry entry, CancellationToken cancellationToken = default)
    {
        var line = JsonSerializer.Serialize(entry);
        var logsDirectory = Path.Combine(Directory.GetCurrentDirectory(), "logs");
        Directory.CreateDirectory(logsDirectory);

        var filePath = Path.Combine(logsDirectory, "integration-whatsapp-audit.log");

        await FileLock.WaitAsync(cancellationToken);
        try
        {
            await File.AppendAllTextAsync(filePath, line + Environment.NewLine, cancellationToken);
        }
        finally
        {
            FileLock.Release();
        }

        logger.LogInformation("Integration audit {Status} client={ClientId} scope={Scope} detail={Detail}", entry.Status, entry.ClientId, entry.Scope, entry.Detail);
    }
}
