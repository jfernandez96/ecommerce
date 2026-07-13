use [ecommerce];
go

set nocount on;
go

begin try
    begin transaction;

    -- 1) Limpiar transacciones/ventas relacionadas a productos
    delete from [dbo].[Payments];
    delete from [dbo].[SaleItems];
    delete from [dbo].[Sales];

    -- 2) Limpiar promociones y banners
    delete from [dbo].[Promotions];
    delete from [dbo].[Banners];

    -- 3) Limpiar catalogo de productos
    delete from [dbo].[ProductReviews];
    delete from [dbo].[ProductTags];
    delete from [dbo].[ProductVariants];
    delete from [dbo].[ProductImages];
    delete from [dbo].[Products];

    -- 4) Limpiar categorias y marcas
    delete from [dbo].[Categoria];
    delete from [dbo].[Marca];

    -- 5) Re-sembrar secciones principales del menu
    insert into [dbo].[Categoria] ([Id], [Name], [Slug], [Description], [ImageUrl], [ParentId], [IsActive], [CreatedAt], [IsDeleted], [SortOrder])
    values
    (cast('33333333-3333-3333-3333-333333333333' as uniqueidentifier), N'Hombre', N'hombre', N'Seccion principal Hombre', null, null, 1, sysutcdatetime(), 0, 0),
    (cast('55555555-5555-5555-5555-555555555555' as uniqueidentifier), N'Mujeres', N'mujeres', N'Seccion principal Mujeres', null, null, 1, sysutcdatetime(), 0, 1),
    (cast('44444444-4444-4444-4444-444444444444' as uniqueidentifier), N'Zapatillas', N'zapatillas', N'Seccion principal Zapatillas', null, null, 1, sysutcdatetime(), 0, 2),
    (cast('66666666-6666-6666-6666-666666666666' as uniqueidentifier), N'Accesorios', N'accesorios', N'Seccion principal Accesorios', null, null, 1, sysutcdatetime(), 0, 3);

    -- 6) Re-sembrar marcas base
    insert into [dbo].[Marca] ([Id], [Name], [Slug], [IsActive], [CreatedAt], [IsDeleted])
    values
    (cast('11111111-1111-1111-1111-111111111111' as uniqueidentifier), N'Atelier Norte', N'atelier-norte', 1, sysutcdatetime(), 0),
    (cast('22222222-2222-2222-2222-222222222222' as uniqueidentifier), N'Stride', N'stride', 1, sysutcdatetime(), 0);

    commit transaction;
    print 'Reset completado. Menu y catalogo reconfigurados con secciones base.';
end try
begin catch
    if @@trancount > 0 rollback transaction;
    throw;
end catch;
go
