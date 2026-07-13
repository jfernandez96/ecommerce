using Ecommerce.Domain.Users;
using Ecommerce.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Ecommerce.IntegrationTests;

public sealed class TestApiFactory : WebApplicationFactory<Program>
{
    private readonly string databaseName = $"integration-auth-{Guid.NewGuid()}";

    public const string AdminEmail = "admin@ecommerce.local";
    public const string AdminPassword = "Admin123*";
    private const string AdminPasswordHash = "100000.MDEyMzQ1Njc4OWFiY2RlZg==.x5PgGELHeFjERkv+IooGuqzC2YCKhB/vSsFF3f7/3X4=";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.RemoveAll<AppDbContext>();
            services.RemoveAll<IDbContextOptionsConfiguration<AppDbContext>>();

            services.AddDbContext<AppDbContext>(options =>
                options.UseInMemoryDatabase(databaseName));
        });
    }

    public async Task SeedAdminAsync()
    {
        using var scope = Services.CreateScope();
        var serviceProvider = scope.ServiceProvider;
        var dbContext = serviceProvider.GetRequiredService<AppDbContext>();

        await dbContext.Database.EnsureCreatedAsync();

        if (await dbContext.Users.AnyAsync(user => user.Email == AdminEmail))
        {
            return;
        }

        dbContext.Users.Add(new AppUser
        {
            Email = AdminEmail,
            FullName = "Integration Admin",
            PasswordHash = AdminPasswordHash,
            Role = UserRole.Administrator,
            IsActive = true,
        });

        await dbContext.SaveChangesAsync();
    }
}
