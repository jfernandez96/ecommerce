# Integracion de terceros: envio de WhatsApp

Esta guia explica como consumir el endpoint de integracion para enviar mensajes de WhatsApp desde un sistema externo (ERP, CRM, bot, etc.).

## Endpoint

- Metodo: `POST`
- Ruta versionada: `/api/v1/integrations/whatsapp/send`
- Controller: `IntegrationsController`

URL local completa de ejemplo:

```text
http://localhost:5036/api/v1/integrations/whatsapp/send
```

## Autenticacion

Debes enviar estos headers:

- `X-Integration-Client`: identificador del cliente de integracion.
- `X-Api-Key`: API key configurada para ese cliente.

## Configuracion en backend

Define tus clientes en `appsettings.json` o variables de entorno equivalentes:

```json
{
  "Integrations": {
    "Clients": [
      {
        "ClientId": "erp-prod",
        "ApiKey": "CAMBIA_ESTA_CLAVE_LARGA",
        "Enabled": true,
        "MaxRequestsPerMinute": 60,
        "Scopes": ["whatsapp.send"]
      }
    ]
  }
}
```

Variables de entorno equivalentes (ejemplo):

```text
Integrations__Clients__0__ClientId=erp-prod
Integrations__Clients__0__ApiKey=CAMBIA_ESTA_CLAVE_LARGA
Integrations__Clients__0__Enabled=true
Integrations__Clients__0__MaxRequestsPerMinute=60
Integrations__Clients__0__Scopes__0=whatsapp.send
```

## Body del request

```json
{
  "toPhone": "+51999999999",
  "message": "Hola, tu pedido #A-1024 ya fue despachado.",
  "externalId": "A-1024",
  "sourceSystem": "erp"
}
```

Reglas actuales de validacion:

- `toPhone`: requerido, maximo 30 caracteres.
- `message`: requerido, maximo 1200 caracteres.
- `externalId`: opcional, maximo 120 caracteres.
- `sourceSystem`: opcional, maximo 120 caracteres.

## Ejemplo rapido con cURL

```bash
curl -X POST "http://localhost:5036/api/v1/integrations/whatsapp/send" \
  -H "Content-Type: application/json" \
  -H "X-Integration-Client: erp-prod" \
  -H "X-Api-Key: CAMBIA_ESTA_CLAVE_LARGA" \
  -d '{
    "toPhone": "+51999999999",
    "message": "Hola, tu pedido #A-1024 ya fue despachado.",
    "externalId": "A-1024",
    "sourceSystem": "erp"
  }'
```

## Ejemplo con PowerShell

```powershell
$headers = @{
  "X-Integration-Client" = "erp-prod"
  "X-Api-Key" = "CAMBIA_ESTA_CLAVE_LARGA"
}

$body = @{
  toPhone = "+51999999999"
  message = "Hola, tu pedido #A-1024 ya fue despachado."
  externalId = "A-1024"
  sourceSystem = "erp"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method POST `
  -Uri "http://localhost:5036/api/v1/integrations/whatsapp/send" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $body
```

## Respuestas esperadas

### 200 OK

```json
{
  "status": "sent",
  "clientId": "erp-prod",
  "message": "Mensaje enviado correctamente.",
  "externalId": "A-1024",
  "sentAt": "2026-07-20T18:52:10.321Z"
}
```

### 401 Unauthorized

Cuando falta header, cliente invalido, scope no permitido o API key incorrecta:

```json
{
  "code": "invalid_api_key",
  "detail": "API key invalida."
}
```

Posibles codigos de error 401:

- `missing_credentials`
- `invalid_client`
- `scope_denied`
- `invalid_api_key`

### 429 Too Many Requests

Cuando el cliente supera `MaxRequestsPerMinute`.

```json
{
  "code": "rate_limited",
  "detail": "Rate limit excedido para el cliente."
}
```

La respuesta incluye header `Retry-After` con los segundos sugeridos para reintentar.

### 502 Bad Gateway

Si falla el proveedor de WhatsApp:

```json
{
  "code": "provider_error",
  "detail": "No se pudo enviar el mensaje de WhatsApp."
}
```

## Auditoria

Cada intento (denegado, exitoso o error de proveedor) se escribe en:

```text
logs/integration-whatsapp-audit.log
```

Campos auditados: timestamp, canal, scope, clientId, sourceSystem, externalId, toPhone, estado, detalle, ip y user-agent.

## Como lo usaria en produccion

1. Crear un `ClientId` por sistema externo (por ejemplo `erp-prod`, `crm-prod`).
2. Generar una API key larga y unica por cliente.
3. Configurar `Scopes` minimos requeridos (`whatsapp.send`).
4. Ajustar `MaxRequestsPerMinute` segun carga esperada.
5. Consumir el endpoint desde el sistema externo con retry exponencial ante `429` usando `Retry-After`.
6. Monitorear `logs/integration-whatsapp-audit.log` para trazabilidad y soporte.

## Recomendaciones de seguridad

- Rota API keys periodicamente.
- No reutilices la misma API key entre clientes.
- Guarda API keys en secret manager o variables de entorno seguras.
- No pongas API keys en frontend ni clientes moviles.