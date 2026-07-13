using Ecommerce.Application.Auth;
using Ecommerce.Application.Common;
using Ecommerce.Application.Products;
using Ecommerce.Infrastructure.Media;
using Ecommerce.Domain.Customers;
using Ecommerce.Infrastructure.Notifications;
using Ecommerce.Infrastructure.Payments;
using Ecommerce.Infrastructure.Persistence;
using Ecommerce.Infrastructure.Sales;
using Ecommerce.Infrastructure.Security;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Ecommerce.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddMediatR(configuration => configuration.RegisterServicesFromAssembly(typeof(DependencyInjection).Assembly));
        services.AddDbContext<AppDbContext>(options => options.UseSqlServer(configuration.GetConnectionString("SqlServer")));
        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<IProductRepository, ProductRepository>();
        services.AddScoped<ICategoryRepository, CategoryRepository>();
        services.AddScoped<IBrandRepository, BrandRepository>();
        services.AddScoped<IOrderRepository, OrderRepository>();
        services.AddScoped<ISaleRepository, SaleRepository>();
        services.AddScoped<ISalesExportService, SalesExportService>();
        services.AddScoped<ISunatInvoiceService, SunatInvoiceService>();
        services.AddScoped<IInventoryMovementRepository, InventoryMovementRepository>();
        services.AddScoped<IPromotionRepository, PromotionRepository>();
        services.AddScoped<IBannerRepository, BannerRepository>();
        services.AddScoped<IWishlistRepository, WishlistRepository>();
        services.AddScoped<IStoreSettingsRepository, StoreSettingsRepository>();
        services.AddScoped<IStoreLocationRepository, StoreLocationRepository>();
        services.AddScoped<IClaimBookRepository, ClaimBookRepository>();
        services.AddScoped<IOrderNotificationService, OrderNotificationService>();
        services.AddScoped<IWhatsAppNotificationService, WhatsAppNotificationService>();
        services.AddScoped<IProductImageStorageService, LocalProductImageStorageService>();
        services.AddScoped<IProductReadService, ProductReadService>();
        services.AddScoped<IPaymentPreparationService, PaymentPreparationService>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddSingleton<IJwtTokenService, JwtTokenService>();
        services.AddSingleton<IPasswordHasher, PasswordHasher>();
        return services;
    }
}