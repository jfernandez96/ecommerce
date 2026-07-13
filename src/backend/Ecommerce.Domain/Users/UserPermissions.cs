namespace Ecommerce.Domain.Users;

public static class PermissionClaimTypes
{
    public const string Permission = "permission";
}

public static class UserPermissionNames
{
    public const string BrandsManage = "brands.manage";
    public const string CategoriesManage = "categories.manage";
    public const string ProductsManage = "products.manage";
    public const string PromotionsManage = "promotions.manage";
    public const string BannersManage = "banners.manage";
    public const string InventoryRead = "inventory.read";
    public const string InventoryWrite = "inventory.write";
    public const string OrdersRead = "orders.read";
    public const string OrdersUpdate = "orders.update";
    public const string SalesRead = "sales.read";
    public const string SalesExport = "sales.export";
    public const string SalesSunat = "sales.sunat";
    public const string UsersRead = "users.read";
    public const string UsersManage = "users.manage";
    public const string StoresRead = "stores.read";
    public const string StoresManage = "stores.manage";
    public const string SettingsManage = "settings.manage";

    public static readonly string[] All =
    [
        BrandsManage,
        CategoriesManage,
        ProductsManage,
        PromotionsManage,
        BannersManage,
        InventoryRead,
        InventoryWrite,
        OrdersRead,
        OrdersUpdate,
        SalesRead,
        SalesExport,
        SalesSunat,
        UsersRead,
        UsersManage,
        StoresRead,
        StoresManage,
        SettingsManage,
    ];

    private static readonly string[] EmployeeDefault =
    [
        BrandsManage,
        CategoriesManage,
        ProductsManage,
        PromotionsManage,
        BannersManage,
        InventoryRead,
        InventoryWrite,
        OrdersRead,
        OrdersUpdate,
        StoresRead,
        SalesRead,
        SalesExport,
    ];

    public static IReadOnlyList<string> ForRole(UserRole role) => role switch
    {
        UserRole.Administrator => All,
        UserRole.Employee => EmployeeDefault,
        _ => [],
    };
}