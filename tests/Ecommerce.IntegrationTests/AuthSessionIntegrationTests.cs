using System.Net;
using System.Net.Http.Json;
using Ecommerce.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Ecommerce.IntegrationTests;

public sealed class AuthSessionIntegrationTests : IAsyncLifetime
{
    private readonly TestApiFactory factory = new();

    public async Task InitializeAsync()
    {
        using var client = factory.CreateClient();
        await factory.SeedAdminAsync();
    }

    public Task DisposeAsync() => factory.DisposeAsync().AsTask();

    [Fact]
    public async Task Login_Refresh_Logout_Flow_ShouldWorkWithHttpOnlyCookies()
    {
        using var client = factory.CreateClient();

        var login = await LoginAsync(client);
        login.StatusCode.Should().Be(HttpStatusCode.OK);
        login.Headers.TryGetValues("Set-Cookie", out var cookieHeaders).Should().BeTrue();
        cookieHeaders!.Should().Contain(header => header.Contains("accessToken=", StringComparison.OrdinalIgnoreCase));
        cookieHeaders.Should().Contain(header => header.Contains("refreshToken=", StringComparison.OrdinalIgnoreCase));
        cookieHeaders.Should().Contain(header => header.Contains("HttpOnly", StringComparison.OrdinalIgnoreCase));

        var refresh = await client.PostAsync("/api/v1/auth/refresh", content: null);
        refresh.StatusCode.Should().Be(HttpStatusCode.OK);

        var logout = await client.PostAsync("/api/v1/auth/logout", content: null);
        logout.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var refreshAfterLogout = await client.PostAsync("/api/v1/auth/refresh", content: null);
        refreshAfterLogout.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task LogoutAll_ShouldRevokeAllSessions()
    {
        using var clientA = factory.CreateClient();
        using var clientB = factory.CreateClient();

        (await LoginAsync(clientA)).StatusCode.Should().Be(HttpStatusCode.OK);
        (await LoginAsync(clientB)).StatusCode.Should().Be(HttpStatusCode.OK);

        var logoutAll = await clientA.PostAsync("/api/v1/auth/logout-all", content: null);
        logoutAll.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var refreshA = await clientA.PostAsync("/api/v1/auth/refresh", content: null);
        var refreshB = await clientB.PostAsync("/api/v1/auth/refresh", content: null);

        refreshA.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        refreshB.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Login_WhenManySessions_ShouldKeepOnlyFiveActiveRefreshTokens()
    {
        for (var index = 0; index < 7; index++)
        {
            using var client = factory.CreateClient();
            var response = await LoginAsync(client);
            response.StatusCode.Should().Be(HttpStatusCode.OK);
        }

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var adminUser = await dbContext.Users.FirstAsync(user => user.Email == TestApiFactory.AdminEmail);
        var activeTokenCount = await dbContext.RefreshTokens.CountAsync(token =>
            token.UserId == adminUser.Id &&
            !token.IsDeleted &&
            token.RevokedAt == null &&
            token.ExpiresAt > DateTimeOffset.UtcNow);

        activeTokenCount.Should().Be(5);
    }

    private static Task<HttpResponseMessage> LoginAsync(HttpClient client)
    {
        var payload = JsonContent.Create(new
        {
            email = TestApiFactory.AdminEmail,
            password = TestApiFactory.AdminPassword,
        });

        return client.PostAsync("/api/v1/auth/login", payload);
    }
}
