using FluentAssertions;

namespace Ecommerce.IntegrationTests;

public class ApiSmokeTests
{
    [Fact]
    public async Task Swagger_IsAvailable()
    {
        await using var application = new TestApiFactory();
        using var client = application.CreateClient();
        await application.SeedAdminAsync();

        var response = await client.GetAsync("/swagger/v1/swagger.json");

        response.IsSuccessStatusCode.Should().BeTrue();
    }
}
