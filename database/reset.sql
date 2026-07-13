use [ecommerce];
go

set nocount on;
go

begin try
    begin transaction;
  -- limpiar orden 

    delete from Orders;
    delete from OrderItems;

    -- 1) Limpiar transacciones/ventas relacionadas a productos
    delete from [dbo].[Payments];
    delete from [dbo].[SaleItems];
    delete from [dbo].[Sales];

    -- 2) Limpiar promociones y banners
    delete from [dbo].[Promotions];

    -- 3) Limpiar catalogo de productos
    delete from [dbo].[ProductReviews];
    delete from [dbo].[ProductTags];
    delete from [dbo].[ProductVariants];
    delete from [dbo].[ProductImages];
    delete from [dbo].[Products];

 


    commit transaction;
    print 'Reset completado. Menu y catalogo reconfigurados con secciones base.';
end try
begin catch
    rollback transaction;
    throw;
end catch;
go
