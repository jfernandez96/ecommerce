using FluentValidation;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;

namespace Ecommerce.Api.Middleware;

public sealed class ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
{
    private static bool TryGetUniqueConstraintSqlException(Exception exception, out SqlException? sqlException)
    {
        sqlException = exception as SqlException;
        if (sqlException is not null && sqlException.Number is 2601 or 2627)
        {
            return true;
        }

        var dbUpdateException = exception as DbUpdateException;
        if (dbUpdateException?.InnerException is SqlException innerSql && innerSql.Number is 2601 or 2627)
        {
            sqlException = innerSql;
            return true;
        }

        return false;
    }

    private static ValidationProblemDetails BuildUniqueConstraintProblem(SqlException exception)
    {
        if (exception.Message.Contains("UX_Products_Slug", StringComparison.OrdinalIgnoreCase))
        {
            return new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                ["slug"] = ["Ya existe un producto con el mismo nombre o slug. Usa uno diferente."]
            })
            {
                Title = "Registro duplicado",
                Detail = "No se pudo guardar el producto porque ya existe otro con el mismo nombre o slug."
            };
        }

        if (exception.Message.Contains("IX_Products_Sku", StringComparison.OrdinalIgnoreCase) || exception.Message.Contains("UX_Products_Sku", StringComparison.OrdinalIgnoreCase))
        {
            return new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                ["sku"] = ["Ya existe un producto con ese SKU. Usa uno diferente."]
            })
            {
                Title = "Registro duplicado",
                Detail = "No se pudo guardar el producto porque el SKU ya esta registrado."
            };
        }

        return new ValidationProblemDetails(new Dictionary<string, string[]>
        {
            ["request"] = ["Ya existe un registro con uno de los valores unicos enviados."]
        })
        {
            Title = "Registro duplicado",
            Detail = "La operacion no pudo completarse porque ya existe un registro con los mismos datos unicos."
        };
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (OperationCanceledException exception) when (context.RequestAborted.IsCancellationRequested)
        {
            logger.LogInformation(exception, "Request aborted by client: {Method} {Path}", context.Request.Method, context.Request.Path);

            if (!context.Response.HasStarted)
            {
                context.Response.StatusCode = 499;
            }
        }
        catch (ValidationException exception)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await context.Response.WriteAsJsonAsync(new ValidationProblemDetails(exception.Errors.GroupBy(x => x.PropertyName).ToDictionary(x => x.Key, x => x.Select(e => e.ErrorMessage).ToArray())));
        }
        catch (DbUpdateConcurrencyException exception)
        {
            var conflictedEntities = exception.Entries.Select(entry => entry.Metadata.ClrType.Name).Distinct().ToArray();
            logger.LogError(exception, "Concurrency conflict while saving changes. Entities: {Entities}", conflictedEntities);
            context.Response.StatusCode = StatusCodes.Status409Conflict;
            await context.Response.WriteAsJsonAsync(new ProblemDetails
            {
                Title = "Concurrency conflict",
                Detail = "El recurso fue modificado o eliminado por otro proceso. Recarga la informacion e intenta nuevamente."
            });
        }
        catch (InvalidOperationException exception)
        {
            logger.LogWarning(exception, "Business validation failed for request: {Method} {Path}", context.Request.Method, context.Request.Path);
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await context.Response.WriteAsJsonAsync(new ProblemDetails
            {
                Title = "Operacion no permitida",
                Detail = exception.Message
            });
        }
        catch (Exception exception) when (TryGetUniqueConstraintSqlException(exception, out var sqlException))
        {
            logger.LogWarning(exception, "Unique constraint violation while saving changes");
            context.Response.StatusCode = StatusCodes.Status409Conflict;
            await context.Response.WriteAsJsonAsync(BuildUniqueConstraintProblem(sqlException!));
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Unhandled API exception");
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            await context.Response.WriteAsJsonAsync(new ProblemDetails { Title = "Unexpected error", Detail = "A server error occurred." });
        }
    }
}