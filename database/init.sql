if db_id(N'ecommerce') is null
begin
    create database [ecommerce];
end
go

use [ecommerce];
go

if object_id(N'[dbo].[Marca]', N'U') is null
begin
    create table [dbo].[Marca] (
        [Id] uniqueidentifier not null primary key,
        [Name] nvarchar(140) not null,
        [Slug] nvarchar(180) not null,
        [LogoUrl] nvarchar(max) null,
        [IsActive] bit not null default 1,
        [CreatedAt] datetimeoffset not null default sysutcdatetime(),
        [UpdatedAt] datetimeoffset null,
        [CreatedBy] nvarchar(max) null,
        [UpdatedBy] nvarchar(max) null,
        [IsDeleted] bit not null default 0,
        constraint [UX_Marca_Slug] unique ([Slug])
    );
end
go

if object_id(N'[dbo].[Categoria]', N'U') is null
begin
    create table [dbo].[Categoria] (
        [Id] uniqueidentifier not null primary key,
        [Name] nvarchar(140) not null,
        [Slug] nvarchar(180) not null,
        [Description] nvarchar(max) null,
        [ImageUrl] nvarchar(max) null,
        [ParentId] uniqueidentifier null,
        [IsActive] bit not null default 1,
        [CreatedAt] datetimeoffset not null default sysutcdatetime(),
        [UpdatedAt] datetimeoffset null,
        [CreatedBy] nvarchar(max) null,
        [UpdatedBy] nvarchar(max) null,
        [IsDeleted] bit not null default 0,
        constraint [UX_Categoria_Slug] unique ([Slug]),
        constraint [FK_Categoria_Parent] foreign key ([ParentId]) references [dbo].[Categoria]([Id])
    );
end
go

if col_length('dbo.Categoria', 'SortOrder') is null
begin
    alter table [dbo].[Categoria] add [SortOrder] int not null constraint [DF_Categoria_SortOrder] default 0;
end
go

if object_id(N'[dbo].[Products]', N'U') is null
begin
    create table [dbo].[Products] (
        [Id] uniqueidentifier not null primary key,
        [Name] nvarchar(180) not null,
        [Slug] nvarchar(220) not null,
        [Sku] nvarchar(80) not null,
        [Code] nvarchar(80) not null,
        [Description] nvarchar(max) not null default '',
        [LongDescription] nvarchar(max) not null default '',
        [BrandId] uniqueidentifier not null,
        [CategoryId] uniqueidentifier not null,
        [SubcategoryId] uniqueidentifier null,
        [RegularPrice] decimal(18,2) not null,
        [SalePrice] decimal(18,2) null,
        [Cost] decimal(18,2) not null default 0,
        [Stock] int not null default 0,
        [MinimumStock] int not null default 5,
        [WeightKg] decimal(18,3) not null default 0,
        [Material] nvarchar(max) not null default '',
        [Status] int not null default 0,
        [Gender] int not null default 0,
        [VideoUrl] nvarchar(max) null,
        [SeoTitle] nvarchar(max) not null default '',
        [SeoDescription] nvarchar(max) not null default '',
        [CanonicalUrl] nvarchar(max) not null default '',
        [CreatedAt] datetimeoffset not null default sysutcdatetime(),
        [UpdatedAt] datetimeoffset null,
        [CreatedBy] nvarchar(max) null,
        [UpdatedBy] nvarchar(max) null,
        [IsDeleted] bit not null default 0,
        constraint [UX_Products_Slug] unique ([Slug]),
        constraint [UX_Products_Sku] unique ([Sku]),
        constraint [CK_Products_RegularPrice] check ([RegularPrice] > 0),
        constraint [CK_Products_SalePrice] check ([SalePrice] is null or [SalePrice] > 0),
        constraint [CK_Products_Stock] check ([Stock] >= 0),
        constraint [FK_Products_Marca] foreign key ([BrandId]) references [dbo].[Marca]([Id]),
        constraint [FK_Products_Categoria] foreign key ([CategoryId]) references [dbo].[Categoria]([Id]),
        constraint [FK_Products_Subcategoria] foreign key ([SubcategoryId]) references [dbo].[Categoria]([Id])
    );
end
go

if object_id(N'[dbo].[ProductImages]', N'U') is null
begin
    create table [dbo].[ProductImages] (
        [Id] uniqueidentifier not null primary key,
        [ProductId] uniqueidentifier not null,
        [Url] nvarchar(max) not null,
        [AltText] nvarchar(max) not null default '',
        [Color] nvarchar(60) null,
        [SortOrder] int not null default 0,
        [IsPrimary] bit not null default 0,
        [CreatedAt] datetimeoffset not null default sysutcdatetime(),
        [UpdatedAt] datetimeoffset null,
        [CreatedBy] nvarchar(max) null,
        [UpdatedBy] nvarchar(max) null,
        [IsDeleted] bit not null default 0,
        constraint [FK_ProductImages_Products] foreign key ([ProductId]) references [dbo].[Products]([Id]) on delete cascade
    );
end
go

if col_length('dbo.ProductImages', 'Color') is null
begin
    alter table [dbo].[ProductImages] add [Color] nvarchar(60) null;
end
go

if not exists (select 1 from sys.indexes where name = N'IX_ProductImages_Product_Color')
    create index [IX_ProductImages_Product_Color] on [dbo].[ProductImages] ([ProductId], [Color]);
go

if object_id(N'[dbo].[ProductVariants]', N'U') is null
begin
    create table [dbo].[ProductVariants] (
        [Id] uniqueidentifier not null primary key,
        [ProductId] uniqueidentifier not null,
        [Sku] nvarchar(90) not null,
        [Color] nvarchar(60) not null,
        [Size] nvarchar(30) not null,
        [Stock] int not null default 0,
        [PriceAdjustment] decimal(18,2) null,
        [IsActive] bit not null default 1,
        [CreatedAt] datetimeoffset not null default sysutcdatetime(),
        [UpdatedAt] datetimeoffset null,
        [CreatedBy] nvarchar(max) null,
        [UpdatedBy] nvarchar(max) null,
        [IsDeleted] bit not null default 0,
        constraint [UX_ProductVariants_Sku] unique ([Sku]),
        constraint [FK_ProductVariants_Products] foreign key ([ProductId]) references [dbo].[Products]([Id]) on delete cascade
    );
end
go

if object_id(N'[dbo].[InventoryMovements]', N'U') is null
begin
    create table [dbo].[InventoryMovements] (
        [Id] uniqueidentifier not null primary key,
        [ProductId] uniqueidentifier not null,
        [ProductVariantId] uniqueidentifier null,
        [MovementType] int not null,
        [Quantity] int not null,
        [StockBefore] int not null,
        [StockAfter] int not null,
        [SupplierName] nvarchar(180) null,
        [ReferenceCode] nvarchar(100) null,
        [Notes] nvarchar(500) null,
        [CreatedAt] datetimeoffset not null default sysutcdatetime(),
        [UpdatedAt] datetimeoffset null,
        [CreatedBy] nvarchar(max) null,
        [UpdatedBy] nvarchar(max) null,
        [IsDeleted] bit not null default 0,
        constraint [CK_InventoryMovements_Quantity] check ([Quantity] > 0),
        constraint [CK_InventoryMovements_StockBefore] check ([StockBefore] >= 0),
        constraint [CK_InventoryMovements_StockAfter] check ([StockAfter] >= 0),
        constraint [FK_InventoryMovements_Products] foreign key ([ProductId]) references [dbo].[Products]([Id]),
        constraint [FK_InventoryMovements_ProductVariants] foreign key ([ProductVariantId]) references [dbo].[ProductVariants]([Id])
    );
end
go

if not exists (select 1 from sys.indexes where name = N'IX_InventoryMovements_ProductId_CreatedAt')
    create index [IX_InventoryMovements_ProductId_CreatedAt] on [dbo].[InventoryMovements] ([ProductId], [CreatedAt] desc);
go

if not exists (select 1 from sys.indexes where name = N'IX_InventoryMovements_CreatedAt')
    create index [IX_InventoryMovements_CreatedAt] on [dbo].[InventoryMovements] ([CreatedAt] desc);
go

if object_id(N'[dbo].[ProductTags]', N'U') is null
begin
    create table [dbo].[ProductTags] (
        [Id] uniqueidentifier not null primary key,
        [ProductId] uniqueidentifier not null,
        [Name] nvarchar(80) not null,
        [CreatedAt] datetimeoffset not null default sysutcdatetime(),
        [UpdatedAt] datetimeoffset null,
        [CreatedBy] nvarchar(max) null,
        [UpdatedBy] nvarchar(max) null,
        [IsDeleted] bit not null default 0,
        constraint [FK_ProductTags_Products] foreign key ([ProductId]) references [dbo].[Products]([Id]) on delete cascade
    );
end
go

if object_id(N'[dbo].[ProductReviews]', N'U') is null
begin
    create table [dbo].[ProductReviews] (
        [Id] uniqueidentifier not null primary key,
        [ProductId] uniqueidentifier not null,
        [CustomerId] uniqueidentifier not null,
        [Rating] int not null,
        [Comment] nvarchar(max) not null default '',
        [IsApproved] bit not null default 0,
        [CreatedAt] datetimeoffset not null default sysutcdatetime(),
        [UpdatedAt] datetimeoffset null,
        [CreatedBy] nvarchar(max) null,
        [UpdatedBy] nvarchar(max) null,
        [IsDeleted] bit not null default 0,
        constraint [CK_ProductReviews_Rating] check ([Rating] between 1 and 5),
        constraint [FK_ProductReviews_Products] foreign key ([ProductId]) references [dbo].[Products]([Id]) on delete cascade
    );
end
go

if object_id(N'[dbo].[Promotions]', N'U') is null
begin
    create table [dbo].[Promotions] (
        [Id] uniqueidentifier not null primary key,
        [Name] nvarchar(180) not null,
        [Type] int not null,
        [Value] decimal(18,2) not null,
        [StartsAt] datetimeoffset not null,
        [EndsAt] datetimeoffset not null,
        [BannerUrl] nvarchar(max) null,
        [ProductId] uniqueidentifier null,
        [CategoryId] uniqueidentifier null,
        [BrandId] uniqueidentifier null,
        [IsActive] bit not null default 0,
        [CreatedAt] datetimeoffset not null default sysutcdatetime(),
        [UpdatedAt] datetimeoffset null,
        [CreatedBy] nvarchar(max) null,
        [UpdatedBy] nvarchar(max) null,
        [IsDeleted] bit not null default 0,
        constraint [CK_Promotions_Dates] check ([EndsAt] > [StartsAt]),
        constraint [CK_Promotions_Value] check ([Value] >= 0),
        constraint [FK_Promotions_Products] foreign key ([ProductId]) references [dbo].[Products]([Id]),
        constraint [FK_Promotions_Categoria] foreign key ([CategoryId]) references [dbo].[Categoria]([Id]),
        constraint [FK_Promotions_Marca] foreign key ([BrandId]) references [dbo].[Marca]([Id])
    );
end
go

if not exists (select 1 from sys.indexes where name = N'IX_Promotions_IsActive_Dates')
    create index [IX_Promotions_IsActive_Dates] on [dbo].[Promotions] ([IsActive], [StartsAt], [EndsAt]);
go

if not exists (select 1 from sys.indexes where name = N'UX_Promotions_OnlyOneActive')
begin
    if (select count(1) from [dbo].[Promotions] where [IsActive] = 1 and [IsDeleted] = 0) > 1
    begin
        throw 51000, 'Solo puede existir una promocion activa. Ajusta los datos antes de crear el indice UX_Promotions_OnlyOneActive.', 1;
    end

    create unique index [UX_Promotions_OnlyOneActive]
        on [dbo].[Promotions] ([IsActive])
        where [IsActive] = 1 and [IsDeleted] = 0;
end
go

if object_id(N'[dbo].[Banners]', N'U') is null
begin
    create table [dbo].[Banners] (
        [Id] uniqueidentifier not null primary key,
        [Title] nvarchar(180) not null,
        [Subtitle] nvarchar(max) not null default '',
        [ImageUrl] nvarchar(max) not null,
        [LinkUrl] nvarchar(600) null,
        [Placement] nvarchar(80) not null default 'home',
        [SortOrder] int not null default 0,
        [StartsAt] datetimeoffset null,
        [EndsAt] datetimeoffset null,
        [IsActive] bit not null default 1,
        [CreatedAt] datetimeoffset not null default sysutcdatetime(),
        [UpdatedAt] datetimeoffset null,
        [CreatedBy] nvarchar(max) null,
        [UpdatedBy] nvarchar(max) null,
        [IsDeleted] bit not null default 0,
        constraint [CK_Banners_Dates] check ([StartsAt] is null or [EndsAt] is null or [EndsAt] > [StartsAt])
    );
end
go

if not exists (select 1 from sys.indexes where name = N'IX_Banners_Placement_Active_Order')
    create index [IX_Banners_Placement_Active_Order] on [dbo].[Banners] ([Placement], [IsActive], [SortOrder]);
go

if object_id(N'[dbo].[Users]', N'U') is null
begin
    create table [dbo].[Users] (
        [Id] uniqueidentifier not null primary key,
        [Email] nvarchar(256) not null,
        [PasswordHash] nvarchar(max) not null,
        [FullName] nvarchar(180) not null,
        [Role] int not null default 0,
        [IsActive] bit not null default 1,
        [CreatedAt] datetimeoffset not null default sysutcdatetime(),
        [UpdatedAt] datetimeoffset null,
        [CreatedBy] nvarchar(max) null,
        [UpdatedBy] nvarchar(max) null,
        [IsDeleted] bit not null default 0,
        constraint [UX_Users_Email] unique ([Email])
    );
end
go

if object_id(N'[dbo].[RefreshTokens]', N'U') is null
begin
    create table [dbo].[RefreshTokens] (
        [Id] uniqueidentifier not null primary key,
        [UserId] uniqueidentifier not null,
        [TokenHash] nvarchar(max) not null,
        [ExpiresAt] datetimeoffset not null,
        [RevokedAt] datetimeoffset null,
        [ReplacedByTokenHash] nvarchar(max) null,
        [CreatedAt] datetimeoffset not null default sysutcdatetime(),
        [UpdatedAt] datetimeoffset null,
        [CreatedBy] nvarchar(max) null,
        [UpdatedBy] nvarchar(max) null,
        [IsDeleted] bit not null default 0,
        constraint [FK_RefreshTokens_Users] foreign key ([UserId]) references [dbo].[Users]([Id]) on delete cascade
    );
end
go

if object_id(N'[dbo].[RefreshTokens]', N'U') is not null
begin
    if col_length('dbo.RefreshTokens', 'TokenHash') is not null
    begin
        alter table [dbo].[RefreshTokens] alter column [TokenHash] nvarchar(128) not null;
    end;

    if col_length('dbo.RefreshTokens', 'ReplacedByTokenHash') is not null
    begin
        alter table [dbo].[RefreshTokens] alter column [ReplacedByTokenHash] nvarchar(128) null;
    end;

    declare @refreshTokensUniqueUserIndex nvarchar(128);
    select top 1 @refreshTokensUniqueUserIndex = i.[name]
    from sys.indexes i
    inner join sys.index_columns ic on ic.object_id = i.object_id and ic.index_id = i.index_id
    inner join sys.columns c on c.object_id = ic.object_id and c.column_id = ic.column_id
    where i.object_id = object_id(N'[dbo].[RefreshTokens]')
      and i.is_unique = 1
      and c.[name] = 'UserId';

    if @refreshTokensUniqueUserIndex is not null
    begin
        exec('drop index [' + @refreshTokensUniqueUserIndex + '] on [dbo].[RefreshTokens];');
    end;

    if not exists (
        select 1
        from sys.indexes
        where object_id = object_id(N'[dbo].[RefreshTokens]')
          and [name] = N'IX_RefreshTokens_UserId')
    begin
        create index [IX_RefreshTokens_UserId] on [dbo].[RefreshTokens]([UserId]);
    end;
end
go

if object_id(N'[dbo].[UserAuditLogs]', N'U') is null
begin
    create table [dbo].[UserAuditLogs] (
        [Id] uniqueidentifier not null primary key,
        [ActorUserId] uniqueidentifier null,
        [ActorEmail] nvarchar(256) not null,
        [ActorFullName] nvarchar(180) not null,
        [ActorRole] nvarchar(30) not null,
        [TargetUserId] uniqueidentifier not null,
        [TargetEmail] nvarchar(256) not null,
        [TargetFullName] nvarchar(180) not null,
        [Action] nvarchar(80) not null,
        [Details] nvarchar(600) null,
        [CreatedAt] datetimeoffset not null default sysutcdatetime(),
        [UpdatedAt] datetimeoffset null,
        [CreatedBy] nvarchar(max) null,
        [UpdatedBy] nvarchar(max) null,
        [IsDeleted] bit not null default 0,
        constraint [FK_UserAuditLogs_Actor] foreign key ([ActorUserId]) references [dbo].[Users]([Id]) on delete set null,
        constraint [FK_UserAuditLogs_Target] foreign key ([TargetUserId]) references [dbo].[Users]([Id])
    );
end
go

if not exists (select 1 from sys.indexes where object_id = object_id(N'[dbo].[UserAuditLogs]') and [name] = N'IX_UserAuditLogs_TargetUserId_CreatedAt')
begin
    create index [IX_UserAuditLogs_TargetUserId_CreatedAt] on [dbo].[UserAuditLogs]([TargetUserId], [CreatedAt] desc);
end
go

if not exists (select 1 from sys.indexes where object_id = object_id(N'[dbo].[UserAuditLogs]') and [name] = N'IX_UserAuditLogs_ActorUserId_CreatedAt')
begin
    create index [IX_UserAuditLogs_ActorUserId_CreatedAt] on [dbo].[UserAuditLogs]([ActorUserId], [CreatedAt] desc);
end
go

if not exists (select 1 from sys.indexes where object_id = object_id(N'[dbo].[UserAuditLogs]') and [name] = N'IX_UserAuditLogs_Action_CreatedAt')
begin
    create index [IX_UserAuditLogs_Action_CreatedAt] on [dbo].[UserAuditLogs]([Action], [CreatedAt] desc);
end
go

if object_id(N'[dbo].[Departments]', N'U') is null
begin
    create table [dbo].[Departments] (
        [Id] uniqueidentifier not null primary key,
        [CodigoSunat] nvarchar(2) not null,
        [Name] nvarchar(120) not null,
        [IsActive] bit not null default 1,
        [CreatedAt] datetimeoffset not null default sysutcdatetime(),
        constraint [UX_Departments_CodigoSunat] unique ([CodigoSunat])
    );
end
go

if object_id(N'[dbo].[Provinces]', N'U') is null
begin
    create table [dbo].[Provinces] (
        [Id] uniqueidentifier not null primary key,
        [DepartmentId] uniqueidentifier not null,
        [CodigoSunat] nvarchar(4) not null,
        [Name] nvarchar(140) not null,
        [IsActive] bit not null default 1,
        [CreatedAt] datetimeoffset not null default sysutcdatetime(),
        constraint [UX_Provinces_CodigoSunat] unique ([CodigoSunat]),
        constraint [FK_Provinces_Departments] foreign key ([DepartmentId]) references [dbo].[Departments]([Id])
    );
end
go

if object_id(N'[dbo].[Districts]', N'U') is null
begin
    create table [dbo].[Districts] (
        [Id] uniqueidentifier not null primary key,
        [ProvinceId] uniqueidentifier not null,
        [CodigoSunat] nvarchar(6) not null,
        [Name] nvarchar(160) not null,
        [IsActive] bit not null default 1,
        [CreatedAt] datetimeoffset not null default sysutcdatetime(),
        constraint [UX_Districts_CodigoSunat] unique ([CodigoSunat]),
        constraint [FK_Districts_Provinces] foreign key ([ProvinceId]) references [dbo].[Provinces]([Id])
    );
end
go

if object_id(N'[dbo].[Customers]', N'U') is null
begin
    create table [dbo].[Customers] (
        [Id] uniqueidentifier not null primary key,
        [DocumentNumber] nvarchar(20) not null,
        [FullName] nvarchar(180) not null,
        [Email] nvarchar(256) null,
        [Phone] nvarchar(30) null,
        [IsActive] bit not null default 1,
        [CreatedAt] datetimeoffset not null default sysutcdatetime(),
        [UpdatedAt] datetimeoffset null,
        [CreatedBy] nvarchar(max) null,
        [UpdatedBy] nvarchar(max) null,
        [IsDeleted] bit not null default 0,
        constraint [UX_Customers_DocumentNumber] unique ([DocumentNumber])
    );
end
go

if object_id(N'[dbo].[Sales]', N'U') is null
begin
    create table [dbo].[Sales] (
        [Id] uniqueidentifier not null primary key,
        [CustomerId] uniqueidentifier not null,
        [UserId] uniqueidentifier not null,
        [SaleDate] datetimeoffset not null default sysutcdatetime(),
        [Subtotal] decimal(18,2) not null,
        [Discount] decimal(18,2) not null default 0,
        [Tax] decimal(18,2) not null,
        [TaxType] nvarchar(10) not null default N'IGV',
        [TaxRate] decimal(5,2) not null default 18.00,
        [TaxIncludedInPrice] bit not null default 1,
        [Total] decimal(18,2) not null,
        [PaymentMethod] int not null,
        [PaymentStatus] int not null,
        [SaleStatus] int not null,
        [Observations] nvarchar(max) null,
        [DeliveryType] int not null,
        [DepartmentId] uniqueidentifier null,
        [ProvinceId] uniqueidentifier null,
        [DistrictId] uniqueidentifier null,
        [Address] nvarchar(240) null,
        [Reference] nvarchar(240) null,
        [Latitude] decimal(10,7) null,
        [Longitude] decimal(10,7) null,
        [ShippingCost] decimal(18,2) not null default 0,
        [CreatedAt] datetimeoffset not null default sysutcdatetime(),
        [UpdatedAt] datetimeoffset null,
        [IsDeleted] bit not null default 0,
        constraint [FK_Sales_Customers] foreign key ([CustomerId]) references [dbo].[Customers]([Id]),
        constraint [FK_Sales_Users] foreign key ([UserId]) references [dbo].[Users]([Id]),
        constraint [FK_Sales_Departments] foreign key ([DepartmentId]) references [dbo].[Departments]([Id]),
        constraint [FK_Sales_Provinces] foreign key ([ProvinceId]) references [dbo].[Provinces]([Id]),
        constraint [FK_Sales_Districts] foreign key ([DistrictId]) references [dbo].[Districts]([Id]),
        constraint [CK_Sales_Amounts] check ([Subtotal] >= 0 and [Discount] >= 0 and [Tax] >= 0 and [Total] >= 0 and [ShippingCost] >= 0)
    );
end
go

if object_id(N'[dbo].[SaleItems]', N'U') is null
begin
    create table [dbo].[SaleItems] (
        [Id] uniqueidentifier not null primary key,
        [SaleId] uniqueidentifier not null,
        [ProductId] uniqueidentifier not null,
        [Quantity] int not null,
        [Price] decimal(18,2) not null,
        [UnitPriceWithoutTax] decimal(18,2) not null default 0,
        [UnitPriceWithTax] decimal(18,2) not null default 0,
        [TaxType] nvarchar(10) not null default N'IGV',
        [TaxRate] decimal(5,2) not null default 18.00,
        [TaxIncludedInPrice] bit not null default 1,
        [TaxAffectationCode] nvarchar(10) not null default N'10',
        [TaxSchemeId] nvarchar(10) not null default N'1000',
        [TaxSchemeName] nvarchar(20) not null default N'IGV',
        [TaxTypeCode] nvarchar(10) not null default N'VAT',
        [TaxableAmount] decimal(18,2) not null default 0,
        [TaxAmount] decimal(18,2) not null default 0,
        [LineAmountWithoutTax] decimal(18,2) not null default 0,
        [LineAmountWithTax] decimal(18,2) not null default 0,
        [Discount] decimal(18,2) not null default 0,
        [Subtotal] decimal(18,2) not null,
        [Tax] decimal(18,2) not null,
        [Total] decimal(18,2) not null,
        constraint [FK_SaleItems_Sales] foreign key ([SaleId]) references [dbo].[Sales]([Id]) on delete cascade,
        constraint [FK_SaleItems_Products] foreign key ([ProductId]) references [dbo].[Products]([Id]),
        constraint [CK_SaleItems_Quantity] check ([Quantity] > 0)
    );
end
go

if col_length('dbo.Sales', 'OrderId') is null
begin
    alter table [dbo].[Sales] add [OrderId] uniqueidentifier null;
end
go

if col_length('dbo.Sales', 'OrderNumber') is null
begin
    alter table [dbo].[Sales] add [OrderNumber] nvarchar(40) null;
end
go

if col_length('dbo.Sales', 'CustomerName') is null
begin
    alter table [dbo].[Sales] add [CustomerName] nvarchar(180) not null constraint [DF_Sales_CustomerName] default N'';
end
go

if col_length('dbo.Sales', 'CustomerEmail') is null
begin
    alter table [dbo].[Sales] add [CustomerEmail] nvarchar(256) null;
end
go

if col_length('dbo.Sales', 'CustomerPhone') is null
begin
    alter table [dbo].[Sales] add [CustomerPhone] nvarchar(30) null;
end
go

if col_length('dbo.Sales', 'DocumentNumber') is null
begin
    alter table [dbo].[Sales] add [DocumentNumber] nvarchar(20) null;
end
go

if col_length('dbo.Sales', 'DocumentType') is null
begin
    alter table [dbo].[Sales] add [DocumentType] int not null constraint [DF_Sales_DocumentType] default 0;
end
go

if col_length('dbo.Sales', 'CustomerDocumentType') is null
begin
    alter table [dbo].[Sales] add [CustomerDocumentType] int not null constraint [DF_Sales_CustomerDocumentType] default 0;
end
go

if col_length('dbo.Sales', 'SunatSeries') is null
begin
    alter table [dbo].[Sales] add [SunatSeries] nvarchar(10) null;
end
go

if col_length('dbo.Sales', 'SunatCorrelative') is null
begin
    alter table [dbo].[Sales] add [SunatCorrelative] int null;
end
go

if col_length('dbo.Sales', 'SunatStatus') is null
begin
    alter table [dbo].[Sales] add [SunatStatus] nvarchar(30) not null constraint [DF_Sales_SunatStatus] default N'pending';
end
go

if col_length('dbo.Sales', 'SunatStatusMessage') is null
begin
    alter table [dbo].[Sales] add [SunatStatusMessage] nvarchar(600) null;
end
go

if col_length('dbo.Sales', 'SunatTicket') is null
begin
    alter table [dbo].[Sales] add [SunatTicket] nvarchar(80) null;
end
go

if col_length('dbo.Sales', 'SunatDigestValue') is null
begin
    alter table [dbo].[Sales] add [SunatDigestValue] nvarchar(200) null;
end
go

if col_length('dbo.Sales', 'SunatXmlFileName') is null
begin
    alter table [dbo].[Sales] add [SunatXmlFileName] nvarchar(120) null;
end
go

if col_length('dbo.Sales', 'SunatXmlContent') is null
begin
    alter table [dbo].[Sales] add [SunatXmlContent] nvarchar(max) null;
end
go

if col_length('dbo.Sales', 'SunatSentAt') is null
begin
    alter table [dbo].[Sales] add [SunatSentAt] datetimeoffset null;
end
go

if col_length('dbo.Sales', 'SunatAcceptedAt') is null
begin
    alter table [dbo].[Sales] add [SunatAcceptedAt] datetimeoffset null;
end
go

if col_length('dbo.Sales', 'SunatCdrFileName') is null
begin
    alter table [dbo].[Sales] add [SunatCdrFileName] nvarchar(120) null;
end
go

if col_length('dbo.Sales', 'SunatCdrContent') is null
begin
    alter table [dbo].[Sales] add [SunatCdrContent] nvarchar(max) null;
end
go

if col_length('dbo.Sales', 'SunatRawResponse') is null
begin
    alter table [dbo].[Sales] add [SunatRawResponse] nvarchar(max) null;
end
go

if col_length('dbo.Sales', 'SunatXmlStoragePath') is null
begin
    alter table [dbo].[Sales] add [SunatXmlStoragePath] nvarchar(600) null;
end
go

if col_length('dbo.Sales', 'SunatCdrStoragePath') is null
begin
    alter table [dbo].[Sales] add [SunatCdrStoragePath] nvarchar(600) null;
end
go

if col_length('dbo.Sales', 'PaymentReference') is null
begin
    alter table [dbo].[Sales] add [PaymentReference] nvarchar(100) null;
end
go

if col_length('dbo.Sales', 'DepartmentName') is null
begin
    alter table [dbo].[Sales] add [DepartmentName] nvarchar(120) null;
end
go

if col_length('dbo.Sales', 'ProvinceName') is null
begin
    alter table [dbo].[Sales] add [ProvinceName] nvarchar(140) null;
end
go

if col_length('dbo.Sales', 'DistrictName') is null
begin
    alter table [dbo].[Sales] add [DistrictName] nvarchar(160) null;
end
go

if col_length('dbo.Sales', 'SourceChannel') is null
begin
    alter table [dbo].[Sales] add [SourceChannel] int not null constraint [DF_Sales_SourceChannel] default 0;
end
go

if col_length('dbo.Sales', 'TaxType') is null
begin
    alter table [dbo].[Sales] add [TaxType] nvarchar(10) not null constraint [DF_Sales_TaxType] default N'IGV' with values;
end
go

if col_length('dbo.Sales', 'TaxRate') is null
begin
    alter table [dbo].[Sales] add [TaxRate] decimal(5,2) not null constraint [DF_Sales_TaxRate] default 18.00 with values;
end
go

if col_length('dbo.Sales', 'TaxIncludedInPrice') is null
begin
    alter table [dbo].[Sales] add [TaxIncludedInPrice] bit not null constraint [DF_Sales_TaxIncludedInPrice] default 1 with values;
end
go

if col_length('dbo.Sales', 'CreatedBy') is null
begin
    alter table [dbo].[Sales] add [CreatedBy] nvarchar(max) null;
end
go

if col_length('dbo.Sales', 'UpdatedBy') is null
begin
    alter table [dbo].[Sales] add [UpdatedBy] nvarchar(max) null;
end
go

if col_length('dbo.SaleItems', 'ProductVariantId') is null
begin
    alter table [dbo].[SaleItems] add [ProductVariantId] uniqueidentifier null;
end
go

if col_length('dbo.SaleItems', 'ProductName') is null
begin
    alter table [dbo].[SaleItems] add [ProductName] nvarchar(180) not null constraint [DF_SaleItems_ProductName] default N'';
end
go

if col_length('dbo.SaleItems', 'Sku') is null
begin
    alter table [dbo].[SaleItems] add [Sku] nvarchar(90) not null constraint [DF_SaleItems_Sku] default N'';
end
go

if col_length('dbo.SaleItems', 'VariantDescription') is null
begin
    alter table [dbo].[SaleItems] add [VariantDescription] nvarchar(120) null;
end
go

if col_length('dbo.SaleItems', 'UnitPriceWithoutTax') is null
begin
    alter table [dbo].[SaleItems] add [UnitPriceWithoutTax] decimal(18,2) not null constraint [DF_SaleItems_UnitPriceWithoutTax] default 0 with values;
end
go

if col_length('dbo.SaleItems', 'UnitPriceWithTax') is null
begin
    alter table [dbo].[SaleItems] add [UnitPriceWithTax] decimal(18,2) not null constraint [DF_SaleItems_UnitPriceWithTax] default 0 with values;
end
go

if col_length('dbo.SaleItems', 'TaxType') is null
begin
    alter table [dbo].[SaleItems] add [TaxType] nvarchar(10) not null constraint [DF_SaleItems_TaxType] default N'IGV' with values;
end
go

if col_length('dbo.SaleItems', 'TaxRate') is null
begin
    alter table [dbo].[SaleItems] add [TaxRate] decimal(5,2) not null constraint [DF_SaleItems_TaxRate] default 18.00 with values;
end
go

if col_length('dbo.SaleItems', 'TaxIncludedInPrice') is null
begin
    alter table [dbo].[SaleItems] add [TaxIncludedInPrice] bit not null constraint [DF_SaleItems_TaxIncludedInPrice] default 1 with values;
end
go

if col_length('dbo.SaleItems', 'TaxAffectationCode') is null
begin
    alter table [dbo].[SaleItems] add [TaxAffectationCode] nvarchar(10) not null constraint [DF_SaleItems_TaxAffectationCode] default N'10' with values;
end
go

if col_length('dbo.SaleItems', 'TaxSchemeId') is null
begin
    alter table [dbo].[SaleItems] add [TaxSchemeId] nvarchar(10) not null constraint [DF_SaleItems_TaxSchemeId] default N'1000' with values;
end
go

if col_length('dbo.SaleItems', 'TaxSchemeName') is null
begin
    alter table [dbo].[SaleItems] add [TaxSchemeName] nvarchar(20) not null constraint [DF_SaleItems_TaxSchemeName] default N'IGV' with values;
end
go

if col_length('dbo.SaleItems', 'TaxTypeCode') is null
begin
    alter table [dbo].[SaleItems] add [TaxTypeCode] nvarchar(10) not null constraint [DF_SaleItems_TaxTypeCode] default N'VAT' with values;
end
go

if col_length('dbo.SaleItems', 'TaxableAmount') is null
begin
    alter table [dbo].[SaleItems] add [TaxableAmount] decimal(18,2) not null constraint [DF_SaleItems_TaxableAmount] default 0 with values;
end
go

if col_length('dbo.SaleItems', 'TaxAmount') is null
begin
    alter table [dbo].[SaleItems] add [TaxAmount] decimal(18,2) not null constraint [DF_SaleItems_TaxAmount] default 0 with values;
end
go

if col_length('dbo.SaleItems', 'LineAmountWithoutTax') is null
begin
    alter table [dbo].[SaleItems] add [LineAmountWithoutTax] decimal(18,2) not null constraint [DF_SaleItems_LineAmountWithoutTax] default 0 with values;
end
go

if col_length('dbo.SaleItems', 'LineAmountWithTax') is null
begin
    alter table [dbo].[SaleItems] add [LineAmountWithTax] decimal(18,2) not null constraint [DF_SaleItems_LineAmountWithTax] default 0 with values;
end
go

if col_length('dbo.SaleItems', 'CreatedAt') is null
begin
    alter table [dbo].[SaleItems] add [CreatedAt] datetimeoffset not null constraint [DF_SaleItems_CreatedAt] default sysutcdatetime() with values;
end
go

if col_length('dbo.SaleItems', 'UpdatedAt') is null
begin
    alter table [dbo].[SaleItems] add [UpdatedAt] datetimeoffset null;
end
go

if col_length('dbo.SaleItems', 'CreatedBy') is null
begin
    alter table [dbo].[SaleItems] add [CreatedBy] nvarchar(max) null;
end
go

if col_length('dbo.SaleItems', 'UpdatedBy') is null
begin
    alter table [dbo].[SaleItems] add [UpdatedBy] nvarchar(max) null;
end
go

if col_length('dbo.SaleItems', 'IsDeleted') is null
begin
    alter table [dbo].[SaleItems] add [IsDeleted] bit not null constraint [DF_SaleItems_IsDeleted] default 0 with values;
end
go

if exists (select 1 from sys.foreign_keys where name = N'FK_Sales_Customers')
begin
    alter table [dbo].[Sales] drop constraint [FK_Sales_Customers];
end
go

if exists (select 1 from sys.foreign_keys where name = N'FK_Sales_Users')
begin
    alter table [dbo].[Sales] drop constraint [FK_Sales_Users];
end
go

if exists (select 1 from sys.foreign_keys where name = N'FK_Sales_Customers')
begin
    alter table [dbo].[Sales] drop constraint [FK_Sales_Customers];
end
go

if exists (select 1 from sys.columns where object_id = object_id(N'[dbo].[Sales]') and name = N'CustomerId' and is_nullable = 0)
begin
    alter table [dbo].[Sales] alter column [CustomerId] uniqueidentifier null;
end
go

if exists (select 1 from sys.columns where object_id = object_id(N'[dbo].[Sales]') and name = N'UserId' and is_nullable = 0)
begin
    alter table [dbo].[Sales] alter column [UserId] uniqueidentifier null;
end
go

if not exists (select 1 from sys.foreign_keys where name = N'FK_Sales_Customers')
begin
    alter table [dbo].[Sales] add constraint [FK_Sales_Customers] foreign key ([CustomerId]) references [dbo].[Customers]([Id]);
end
go

if not exists (select 1 from sys.foreign_keys where name = N'FK_Sales_Users')
begin
    alter table [dbo].[Sales] add constraint [FK_Sales_Users] foreign key ([UserId]) references [dbo].[Users]([Id]);
end
go

if not exists (select 1 from sys.foreign_keys where name = N'FK_SaleItems_ProductVariants')
begin
    alter table [dbo].[SaleItems] add constraint [FK_SaleItems_ProductVariants] foreign key ([ProductVariantId]) references [dbo].[ProductVariants]([Id]);
end
go

if not exists (select 1 from sys.indexes where name = N'UX_Sales_OrderId' and object_id = object_id(N'[dbo].[Sales]'))
begin
    create unique index [UX_Sales_OrderId] on [dbo].[Sales] ([OrderId]) where [OrderId] is not null;
end
go

if not exists (select 1 from sys.indexes where name = N'IX_Sales_SaleDate_PaymentStatus_SaleStatus' and object_id = object_id(N'[dbo].[Sales]'))
begin
    create index [IX_Sales_SaleDate_PaymentStatus_SaleStatus] on [dbo].[Sales] ([SaleDate] desc, [PaymentStatus], [SaleStatus]);
end
go

if not exists (select 1 from sys.indexes where name = N'IX_SaleItems_ProductId' and object_id = object_id(N'[dbo].[SaleItems]'))
begin
    create index [IX_SaleItems_ProductId] on [dbo].[SaleItems] ([ProductId]);
end
go

if object_id(N'[dbo].[Orders]', N'U') is not null
   and object_id(N'[dbo].[OrderPayments]', N'U') is not null
   and object_id(N'[dbo].[Sales]', N'U') is not null
begin
    insert into [dbo].[Sales] ([Id], [OrderId], [OrderNumber], [CustomerId], [UserId], [CustomerName], [CustomerEmail], [CustomerPhone], [DocumentNumber], [DocumentType], [SaleDate], [Subtotal], [Discount], [Tax], [TaxType], [TaxRate], [TaxIncludedInPrice], [Total], [PaymentMethod], [PaymentStatus], [SaleStatus], [PaymentReference], [Observations], [DeliveryType], [DepartmentName], [ProvinceName], [DistrictName], [Address], [Reference], [ShippingCost], [SourceChannel], [CreatedAt], [UpdatedAt], [IsDeleted])
    select newid(),
           o.[Id],
           o.[Number],
           o.[CustomerId],
           null,
           o.[ShippingAddress_FullName],
           o.[CustomerEmail],
           o.[ShippingAddress_Phone],
           o.[DocumentNumber],
           o.[DocumentType],
           isnull(op.[UpdatedAt], op.[CreatedAt]),
           o.[Subtotal],
           o.[Discount],
           o.[Tax],
           N'IGV',
           cast(18.00 as decimal(5,2)),
           cast(1 as bit),
           o.[Total],
           o.[PaymentMethod],
           1,
           case when o.[Status] in (2, 3, 4) then 2 when o.[Status] = 6 then 4 else 1 end,
           op.[ExternalReference],
           o.[Notes],
           0,
           o.[ShippingAddress_Department],
           o.[ShippingAddress_Province],
           o.[ShippingAddress_District],
           o.[ShippingAddress_Line1],
           o.[ShippingAddress_Reference],
           o.[Shipping],
           0,
           o.[CreatedAt],
           o.[UpdatedAt],
           0
    from [dbo].[Orders] o
    cross apply (
        select top 1 p.[Status], p.[ExternalReference], p.[CreatedAt], p.[UpdatedAt]
        from [dbo].[OrderPayments] p
        where p.[OrderId] = o.[Id] and p.[IsDeleted] = 0
        order by p.[CreatedAt] desc
    ) op
    where op.[Status] = N'confirmed'
      and o.[IsDeleted] = 0
      and not exists (select 1 from [dbo].[Sales] s where s.[OrderId] = o.[Id]);
end
go

if object_id(N'[dbo].[Sales]', N'U') is not null
   and object_id(N'[dbo].[OrderItems]', N'U') is not null
   and object_id(N'[dbo].[SaleItems]', N'U') is not null
begin
    insert into [dbo].[SaleItems] ([Id], [SaleId], [ProductId], [ProductVariantId], [ProductName], [Sku], [VariantDescription], [Quantity], [Price], [UnitPriceWithoutTax], [UnitPriceWithTax], [TaxType], [TaxRate], [TaxIncludedInPrice], [TaxAffectationCode], [TaxSchemeId], [TaxSchemeName], [TaxTypeCode], [TaxableAmount], [TaxAmount], [LineAmountWithoutTax], [LineAmountWithTax], [Discount], [Subtotal], [Tax], [Total], [CreatedAt], [UpdatedAt], [CreatedBy], [UpdatedBy], [IsDeleted])
    select newid(),
           s.[Id],
           oi.[ProductId],
           oi.[ProductVariantId],
           oi.[ProductName],
           oi.[Sku],
           case when oi.[Color] is not null and oi.[Size] is not null then oi.[Color] + N' / ' + oi.[Size] when oi.[Color] is not null then oi.[Color] else oi.[Size] end,
           oi.[Quantity],
           oi.[UnitPrice],
           oi.[UnitPrice],
           oi.[UnitPrice],
           N'IGV',
           cast(18.00 as decimal(5,2)),
           cast(1 as bit),
           N'10',
           N'1000',
           N'IGV',
           N'VAT',
           oi.[Total],
           cast(0 as decimal(18,2)),
           oi.[Total],
           oi.[Total],
           0,
           oi.[Total],
           0,
           oi.[Total],
           oi.[CreatedAt],
           oi.[UpdatedAt],
           oi.[CreatedBy],
           oi.[UpdatedBy],
           0
    from [dbo].[Sales] s
    join [dbo].[OrderItems] oi on oi.[OrderId] = s.[OrderId] and oi.[IsDeleted] = 0
    where not exists (select 1 from [dbo].[SaleItems] si where si.[SaleId] = s.[Id]);
end
go

if object_id(N'[dbo].[Payments]', N'U') is null
begin
    create table [dbo].[Payments] (
        [Id] uniqueidentifier not null primary key,
        [SaleId] uniqueidentifier not null,
        [Method] int not null,
        [OperationNumber] nvarchar(80) null,
        [PaymentDate] datetimeoffset not null default sysutcdatetime(),
        [Status] int not null,
        [Amount] decimal(18,2) not null,
        constraint [FK_Payments_Sales] foreign key ([SaleId]) references [dbo].[Sales]([Id]) on delete cascade,
        constraint [CK_Payments_Amount] check ([Amount] >= 0)
    );
end
go

if object_id(N'[dbo].[Orders]', N'U') is null
begin
    create table [dbo].[Orders] (
        [Id] uniqueidentifier not null primary key,
        [Number] nvarchar(40) not null,
        [CustomerId] uniqueidentifier null,
        [CustomerEmail] nvarchar(256) not null,
        [DocumentNumber] nvarchar(20) not null default '',
        [CustomerDocumentType] int not null default 0,
        [Status] int not null,
        [PaymentMethod] int not null,
        [DocumentType] int not null,
        [Subtotal] decimal(18,2) not null,
        [Discount] decimal(18,2) not null default 0,
        [Tax] decimal(18,2) not null default 0,
        [TaxType] nvarchar(10) not null default N'IGV',
        [TaxRate] decimal(5,2) not null default 18.00,
        [TaxIncludedInPrice] bit not null default 1,
        [Shipping] decimal(18,2) not null default 0,
        [Total] decimal(18,2) not null,
        [TrackingCode] nvarchar(80) not null default '',
        [Notes] nvarchar(max) not null default '',
        [ShippingAddress_FullName] nvarchar(180) not null default '',
        [ShippingAddress_Phone] nvarchar(30) not null default '',
        [ShippingAddress_Line1] nvarchar(240) not null default '',
        [ShippingAddress_District] nvarchar(160) not null default '',
        [ShippingAddress_Province] nvarchar(140) not null default '',
        [ShippingAddress_Department] nvarchar(120) not null default '',
        [ShippingAddress_Reference] nvarchar(240) not null default '',
        [CreatedAt] datetimeoffset not null default sysutcdatetime(),
        [UpdatedAt] datetimeoffset null,
        [CreatedBy] nvarchar(max) null,
        [UpdatedBy] nvarchar(max) null,
        [IsDeleted] bit not null default 0,
        constraint [UX_Orders_Number] unique ([Number]),
        constraint [CK_Orders_Amounts] check ([Subtotal] >= 0 and [Discount] >= 0 and [Tax] >= 0 and [Shipping] >= 0 and [Total] >= 0),
        constraint [FK_Orders_Customers] foreign key ([CustomerId]) references [dbo].[Customers]([Id])
    );
end
go

if col_length('dbo.Orders', 'CustomerDocumentType') is null
begin
    alter table [dbo].[Orders] add [CustomerDocumentType] int not null constraint [DF_Orders_CustomerDocumentType] default 0;
end
go

if col_length('dbo.Orders', 'TaxType') is null
begin
    alter table [dbo].[Orders] add [TaxType] nvarchar(10) not null constraint [DF_Orders_TaxType] default N'IGV' with values;
end
go

if col_length('dbo.Orders', 'TaxRate') is null
begin
    alter table [dbo].[Orders] add [TaxRate] decimal(5,2) not null constraint [DF_Orders_TaxRate] default 18.00 with values;
end
go

if col_length('dbo.Orders', 'TaxIncludedInPrice') is null
begin
    alter table [dbo].[Orders] add [TaxIncludedInPrice] bit not null constraint [DF_Orders_TaxIncludedInPrice] default 1 with values;
end
go

if object_id(N'[dbo].[OrderItems]', N'U') is null
begin
    create table [dbo].[OrderItems] (
        [Id] uniqueidentifier not null primary key,
        [OrderId] uniqueidentifier not null,
        [ProductId] uniqueidentifier not null,
        [ProductVariantId] uniqueidentifier null,
        [ProductName] nvarchar(180) not null,
        [Sku] nvarchar(90) not null,
        [Color] nvarchar(60) null,
        [Size] nvarchar(30) null,
        [UnitPrice] decimal(18,2) not null,
        [UnitPriceWithoutTax] decimal(18,2) not null default 0,
        [UnitPriceWithTax] decimal(18,2) not null default 0,
        [TaxType] nvarchar(10) not null default N'IGV',
        [TaxRate] decimal(5,2) not null default 18.00,
        [TaxIncludedInPrice] bit not null default 1,
        [TaxAffectationCode] nvarchar(10) not null default N'10',
        [TaxSchemeId] nvarchar(10) not null default N'1000',
        [TaxSchemeName] nvarchar(20) not null default N'IGV',
        [TaxTypeCode] nvarchar(10) not null default N'VAT',
        [TaxableAmount] decimal(18,2) not null default 0,
        [TaxAmount] decimal(18,2) not null default 0,
        [LineAmountWithoutTax] decimal(18,2) not null default 0,
        [LineAmountWithTax] decimal(18,2) not null default 0,
        [Quantity] int not null,
        [Total] decimal(18,2) not null,
        [CreatedAt] datetimeoffset not null default sysutcdatetime(),
        [UpdatedAt] datetimeoffset null,
        [CreatedBy] nvarchar(max) null,
        [UpdatedBy] nvarchar(max) null,
        [IsDeleted] bit not null default 0,
        constraint [CK_OrderItems_Quantity] check ([Quantity] > 0),
        constraint [FK_OrderItems_Orders] foreign key ([OrderId]) references [dbo].[Orders]([Id]) on delete cascade,
        constraint [FK_OrderItems_Products] foreign key ([ProductId]) references [dbo].[Products]([Id]),
        constraint [FK_OrderItems_ProductVariants] foreign key ([ProductVariantId]) references [dbo].[ProductVariants]([Id])
    );
end
go

if col_length('dbo.OrderItems', 'Color') is null
begin
    alter table [dbo].[OrderItems] add [Color] nvarchar(60) null;
end
go

if col_length('dbo.OrderItems', 'Size') is null
begin
    alter table [dbo].[OrderItems] add [Size] nvarchar(30) null;
end
go

if col_length('dbo.OrderItems', 'UnitPriceWithoutTax') is null
begin
    alter table [dbo].[OrderItems] add [UnitPriceWithoutTax] decimal(18,2) not null constraint [DF_OrderItems_UnitPriceWithoutTax] default 0 with values;
end
go

if col_length('dbo.OrderItems', 'UnitPriceWithTax') is null
begin
    alter table [dbo].[OrderItems] add [UnitPriceWithTax] decimal(18,2) not null constraint [DF_OrderItems_UnitPriceWithTax] default 0 with values;
end
go

if col_length('dbo.OrderItems', 'TaxType') is null
begin
    alter table [dbo].[OrderItems] add [TaxType] nvarchar(10) not null constraint [DF_OrderItems_TaxType] default N'IGV' with values;
end
go

if col_length('dbo.OrderItems', 'TaxRate') is null
begin
    alter table [dbo].[OrderItems] add [TaxRate] decimal(5,2) not null constraint [DF_OrderItems_TaxRate] default 18.00 with values;
end
go

if col_length('dbo.OrderItems', 'TaxIncludedInPrice') is null
begin
    alter table [dbo].[OrderItems] add [TaxIncludedInPrice] bit not null constraint [DF_OrderItems_TaxIncludedInPrice] default 1 with values;
end
go

if col_length('dbo.OrderItems', 'TaxAffectationCode') is null
begin
    alter table [dbo].[OrderItems] add [TaxAffectationCode] nvarchar(10) not null constraint [DF_OrderItems_TaxAffectationCode] default N'10' with values;
end
go

if col_length('dbo.OrderItems', 'TaxSchemeId') is null
begin
    alter table [dbo].[OrderItems] add [TaxSchemeId] nvarchar(10) not null constraint [DF_OrderItems_TaxSchemeId] default N'1000' with values;
end
go

if col_length('dbo.OrderItems', 'TaxSchemeName') is null
begin
    alter table [dbo].[OrderItems] add [TaxSchemeName] nvarchar(20) not null constraint [DF_OrderItems_TaxSchemeName] default N'IGV' with values;
end
go

if col_length('dbo.OrderItems', 'TaxTypeCode') is null
begin
    alter table [dbo].[OrderItems] add [TaxTypeCode] nvarchar(10) not null constraint [DF_OrderItems_TaxTypeCode] default N'VAT' with values;
end
go

if col_length('dbo.OrderItems', 'TaxableAmount') is null
begin
    alter table [dbo].[OrderItems] add [TaxableAmount] decimal(18,2) not null constraint [DF_OrderItems_TaxableAmount] default 0 with values;
end
go

if col_length('dbo.OrderItems', 'TaxAmount') is null
begin
    alter table [dbo].[OrderItems] add [TaxAmount] decimal(18,2) not null constraint [DF_OrderItems_TaxAmount] default 0 with values;
end
go

if col_length('dbo.OrderItems', 'LineAmountWithoutTax') is null
begin
    alter table [dbo].[OrderItems] add [LineAmountWithoutTax] decimal(18,2) not null constraint [DF_OrderItems_LineAmountWithoutTax] default 0 with values;
end
go

if col_length('dbo.OrderItems', 'LineAmountWithTax') is null
begin
    alter table [dbo].[OrderItems] add [LineAmountWithTax] decimal(18,2) not null constraint [DF_OrderItems_LineAmountWithTax] default 0 with values;
end
go

if object_id(N'[dbo].[OrderPayments]', N'U') is null
begin
    create table [dbo].[OrderPayments] (
        [Id] uniqueidentifier not null primary key,
        [OrderId] uniqueidentifier not null,
        [Method] int not null,
        [Provider] nvarchar(40) not null,
        [Status] nvarchar(40) not null,
        [IntegrationMode] nvarchar(60) not null,
        [Amount] decimal(18,2) not null,
        [Currency] nvarchar(10) not null default 'PEN',
        [ExternalReference] nvarchar(80) not null,
        [PublicKey] nvarchar(220) null,
        [ClientSecret] nvarchar(220) null,
        [CheckoutUrl] nvarchar(600) null,
        [QrCodeUrl] nvarchar(600) null,
        [ExpiresAt] datetimeoffset null,
        [MetadataJson] nvarchar(max) null,
        [CreatedAt] datetimeoffset not null default sysutcdatetime(),
        [UpdatedAt] datetimeoffset null,
        [CreatedBy] nvarchar(max) null,
        [UpdatedBy] nvarchar(max) null,
        [IsDeleted] bit not null default 0,
        constraint [CK_OrderPayments_Amount] check ([Amount] >= 0),
        constraint [FK_OrderPayments_Orders] foreign key ([OrderId]) references [dbo].[Orders]([Id]) on delete cascade
    );
end
go

if not exists (select 1 from sys.indexes where name = N'IX_Sales_Date_Status')
    create index [IX_Sales_Date_Status] on [dbo].[Sales] ([SaleDate], [SaleStatus], [PaymentStatus]);
go

if not exists (select 1 from sys.indexes where name = N'IX_Orders_Status_CreatedAt')
    create index [IX_Orders_Status_CreatedAt] on [dbo].[Orders] ([Status], [CreatedAt]);
go

if not exists (select 1 from sys.indexes where name = N'IX_OrderPayments_Provider_Status')
    create index [IX_OrderPayments_Provider_Status] on [dbo].[OrderPayments] ([Provider], [Status]);
go

if not exists (select 1 from sys.indexes where name = N'IX_Customers_Name')
    create index [IX_Customers_Name] on [dbo].[Customers] ([FullName]);
go

merge [dbo].[Departments] as target
using (values
    (newid(), N'01', N'Amazonas'), (newid(), N'02', N'Ancash'), (newid(), N'03', N'Apurimac'), (newid(), N'04', N'Arequipa'), (newid(), N'05', N'Ayacucho'),
    (newid(), N'06', N'Cajamarca'), (newid(), N'07', N'Callao'), (newid(), N'08', N'Cusco'), (newid(), N'09', N'Huancavelica'), (newid(), N'10', N'Huanuco'),
    (newid(), N'11', N'Ica'), (newid(), N'12', N'Junin'), (newid(), N'13', N'La Libertad'), (newid(), N'14', N'Lambayeque'), (newid(), N'15', N'Lima'),
    (newid(), N'16', N'Loreto'), (newid(), N'17', N'Madre de Dios'), (newid(), N'18', N'Moquegua'), (newid(), N'19', N'Pasco'), (newid(), N'20', N'Piura'),
    (newid(), N'21', N'Puno'), (newid(), N'22', N'San Martin'), (newid(), N'23', N'Tacna'), (newid(), N'24', N'Tumbes'), (newid(), N'25', N'Ucayali')
) as source ([Id], [CodigoSunat], [Name])
on target.[CodigoSunat] = source.[CodigoSunat]
when not matched then insert ([Id], [CodigoSunat], [Name]) values (source.[Id], source.[CodigoSunat], source.[Name]);
go

-- ─── Provinces: all 196 provinces of Peru ────────────────────────────────────
if not exists (select 1 from [dbo].[Provinces] where [CodigoSunat] = N'0101')
begin
    insert into [dbo].[Provinces] ([Id], [DepartmentId], [CodigoSunat], [Name])
    select newid(), d.[Id], prov.[CodigoSunat], prov.[Name]
    from (values
        -- Amazonas (01)
        (N'01',N'0101',N'Chachapoyas'),(N'01',N'0102',N'Bagua'),(N'01',N'0103',N'Bongara'),
        (N'01',N'0104',N'Condorcanqui'),(N'01',N'0105',N'Luya'),(N'01',N'0106',N'Rodriguez De Mendoza'),
        (N'01',N'0107',N'Utcubamba'),
        -- Ancash (02)
        (N'02',N'0201',N'Huaraz'),(N'02',N'0202',N'Aija'),(N'02',N'0203',N'Antonio Raymondi'),
        (N'02',N'0204',N'Asuncion'),(N'02',N'0205',N'Bolognesi'),(N'02',N'0206',N'Carhuaz'),
        (N'02',N'0207',N'Carlos Fermin Fitzcarrald'),(N'02',N'0208',N'Casma'),(N'02',N'0209',N'Corongo'),
        (N'02',N'0210',N'Huari'),(N'02',N'0211',N'Huarmey'),(N'02',N'0212',N'Huaylas'),
        (N'02',N'0213',N'Mariscal Luzuriaga'),(N'02',N'0214',N'Ocros'),(N'02',N'0215',N'Pallasca'),
        (N'02',N'0216',N'Pomabamba'),(N'02',N'0217',N'Recuay'),(N'02',N'0218',N'Santa'),
        (N'02',N'0219',N'Sihuas'),(N'02',N'0220',N'Yungay'),
        -- Apurimac (03)
        (N'03',N'0301',N'Abancay'),(N'03',N'0302',N'Andahuaylas'),(N'03',N'0303',N'Antabamba'),
        (N'03',N'0304',N'Aymaraes'),(N'03',N'0305',N'Cotabambas'),(N'03',N'0306',N'Chincheros'),
        (N'03',N'0307',N'Grau'),
        -- Arequipa (04)
        (N'04',N'0401',N'Arequipa'),(N'04',N'0402',N'Camana'),(N'04',N'0403',N'Caraveli'),
        (N'04',N'0404',N'Castilla'),(N'04',N'0405',N'Caylloma'),(N'04',N'0406',N'Condesuyos'),
        (N'04',N'0407',N'Islay'),(N'04',N'0408',N'La Union'),
        -- Ayacucho (05)
        (N'05',N'0501',N'Huamanga'),(N'05',N'0502',N'Cangallo'),(N'05',N'0503',N'Huanca Sancos'),
        (N'05',N'0504',N'Huanta'),(N'05',N'0505',N'La Mar'),(N'05',N'0506',N'Lucanas'),
        (N'05',N'0507',N'Parinacochas'),(N'05',N'0508',N'Paucar Del Sara Sara'),(N'05',N'0509',N'Sucre'),
        (N'05',N'0510',N'Victor Fajardo'),(N'05',N'0511',N'Vilcas Huaman'),
        -- Cajamarca (06)
        (N'06',N'0601',N'Cajamarca'),(N'06',N'0602',N'Cajabamba'),(N'06',N'0603',N'Celendin'),
        (N'06',N'0604',N'Chota'),(N'06',N'0605',N'Contumaza'),(N'06',N'0606',N'Cutervo'),
        (N'06',N'0607',N'Hualgayoc'),(N'06',N'0608',N'Jaen'),(N'06',N'0609',N'San Ignacio'),
        (N'06',N'0610',N'San Marcos'),(N'06',N'0611',N'San Miguel'),(N'06',N'0612',N'San Pablo'),
        (N'06',N'0613',N'Santa Cruz'),
        -- Callao (07)
        (N'07',N'0701',N'Callao'),
        -- Cusco (08)
        (N'08',N'0801',N'Cusco'),(N'08',N'0802',N'Acomayo'),(N'08',N'0803',N'Anta'),
        (N'08',N'0804',N'Calca'),(N'08',N'0805',N'Canas'),(N'08',N'0806',N'Canchis'),
        (N'08',N'0807',N'Chumbivilcas'),(N'08',N'0808',N'Espinar'),(N'08',N'0809',N'La Convencion'),
        (N'08',N'0810',N'Paruro'),(N'08',N'0811',N'Paucartambo'),(N'08',N'0812',N'Quispicanchi'),
        (N'08',N'0813',N'Urubamba'),
        -- Huancavelica (09)
        (N'09',N'0901',N'Huancavelica'),(N'09',N'0902',N'Acobamba'),(N'09',N'0903',N'Angaraes'),
        (N'09',N'0904',N'Castrovirreyna'),(N'09',N'0905',N'Churcampa'),(N'09',N'0906',N'Huaytara'),
        (N'09',N'0907',N'Tayacaja'),
        -- Huanuco (10)
        (N'10',N'1001',N'Huanuco'),(N'10',N'1002',N'Ambo'),(N'10',N'1003',N'Dos De Mayo'),
        (N'10',N'1004',N'Huacaybamba'),(N'10',N'1005',N'Huamalies'),(N'10',N'1006',N'Leoncio Prado'),
        (N'10',N'1007',N'Marañon'),(N'10',N'1008',N'Pachitea'),(N'10',N'1009',N'Puerto Inca'),
        (N'10',N'1010',N'Lauricocha'),(N'10',N'1011',N'Yarowilca'),
        -- Ica (11)
        (N'11',N'1101',N'Ica'),(N'11',N'1102',N'Chincha'),(N'11',N'1103',N'Nasca'),
        (N'11',N'1104',N'Palpa'),(N'11',N'1105',N'Pisco'),
        -- Junin (12)
        (N'12',N'1201',N'Huancayo'),(N'12',N'1202',N'Concepcion'),(N'12',N'1203',N'Chanchamayo'),
        (N'12',N'1204',N'Jauja'),(N'12',N'1205',N'Junin'),(N'12',N'1206',N'Satipo'),
        (N'12',N'1207',N'Tarma'),(N'12',N'1208',N'Yauli'),(N'12',N'1209',N'Chupaca'),
        -- La Libertad (13)
        (N'13',N'1301',N'Trujillo'),(N'13',N'1302',N'Ascope'),(N'13',N'1303',N'Bolivar'),
        (N'13',N'1304',N'Chepen'),(N'13',N'1305',N'Julcan'),(N'13',N'1306',N'Otuzco'),
        (N'13',N'1307',N'Pacasmayo'),(N'13',N'1308',N'Pataz'),(N'13',N'1309',N'Sanchez Carrion'),
        (N'13',N'1310',N'Santiago De Chuco'),(N'13',N'1311',N'Gran Chimu'),(N'13',N'1312',N'Viru'),
        -- Lambayeque (14)
        (N'14',N'1401',N'Chiclayo'),(N'14',N'1402',N'Ferreñafe'),(N'14',N'1403',N'Lambayeque'),
        -- Lima (15)
        (N'15',N'1501',N'Lima'),(N'15',N'1502',N'Barranca'),(N'15',N'1503',N'Cajatambo'),
        (N'15',N'1504',N'Canta'),(N'15',N'1505',N'Cañete'),(N'15',N'1506',N'Huaral'),
        (N'15',N'1507',N'Huarochiri'),(N'15',N'1508',N'Huaura'),(N'15',N'1509',N'Oyon'),
        (N'15',N'1510',N'Yauyos'),
        -- Loreto (16)
        (N'16',N'1601',N'Maynas'),(N'16',N'1602',N'Alto Amazonas'),(N'16',N'1603',N'Loreto'),
        (N'16',N'1604',N'Mariscal Ramon Castilla'),(N'16',N'1605',N'Requena'),(N'16',N'1606',N'Ucayali'),
        (N'16',N'1607',N'Datem Del Marañon'),(N'16',N'1608',N'Putumayo'),
        -- Madre de Dios (17)
        (N'17',N'1701',N'Tambopata'),(N'17',N'1702',N'Manu'),(N'17',N'1703',N'Tahuamanu'),
        -- Moquegua (18)
        (N'18',N'1801',N'Mariscal Nieto'),(N'18',N'1802',N'General Sanchez Cerro'),(N'18',N'1803',N'Ilo'),
        -- Pasco (19)
        (N'19',N'1901',N'Pasco'),(N'19',N'1902',N'Daniel Alcides Carrion'),(N'19',N'1903',N'Oxapampa'),
        -- Piura (20)
        (N'20',N'2001',N'Piura'),(N'20',N'2002',N'Ayabaca'),(N'20',N'2003',N'Huancabamba'),
        (N'20',N'2004',N'Morropon'),(N'20',N'2005',N'Paita'),(N'20',N'2006',N'Sullana'),
        (N'20',N'2007',N'Talara'),(N'20',N'2008',N'Sechura'),
        -- Puno (21)
        (N'21',N'2101',N'Puno'),(N'21',N'2102',N'Azangaro'),(N'21',N'2103',N'Carabaya'),
        (N'21',N'2104',N'Chucuito'),(N'21',N'2105',N'El Collao'),(N'21',N'2106',N'Huancane'),
        (N'21',N'2107',N'Lampa'),(N'21',N'2108',N'Melgar'),(N'21',N'2109',N'Moho'),
        (N'21',N'2110',N'San Antonio De Putina'),(N'21',N'2111',N'San Roman'),(N'21',N'2112',N'Sandia'),
        (N'21',N'2113',N'Yunguyo'),
        -- San Martin (22)
        (N'22',N'2201',N'Moyobamba'),(N'22',N'2202',N'Bellavista'),(N'22',N'2203',N'El Dorado'),
        (N'22',N'2204',N'Huallaga'),(N'22',N'2205',N'Lamas'),(N'22',N'2206',N'Mariscal Caceres'),
        (N'22',N'2207',N'Picota'),(N'22',N'2208',N'Rioja'),(N'22',N'2209',N'San Martin'),
        (N'22',N'2210',N'Tocache'),
        -- Tacna (23)
        (N'23',N'2301',N'Tacna'),(N'23',N'2302',N'Candarave'),(N'23',N'2303',N'Jorge Basadre'),
        (N'23',N'2304',N'Tarata'),
        -- Tumbes (24)
        (N'24',N'2401',N'Tumbes'),(N'24',N'2402',N'Contralmirante Villar'),(N'24',N'2403',N'Zarumilla'),
        -- Ucayali (25)
        (N'25',N'2501',N'Coronel Portillo'),(N'25',N'2502',N'Atalaya'),
        (N'25',N'2503',N'Padre Abad'),(N'25',N'2504',N'Purus')
    ) as prov ([DeptCode], [CodigoSunat], [Name])
    join [dbo].[Departments] d on d.[CodigoSunat] = prov.[DeptCode];
end
go

-- ─── Districts: run database/ubigeo-distritos.sql for full seeding ──────────
-- Lima (1501) base districts seeded here for quick startup
if not exists (select 1 from [dbo].[Districts] where [CodigoSunat] = N'150101')
begin
    insert into [dbo].[Districts] ([Id],[ProvinceId],[CodigoSunat],[Name])
    select newid(), p.[Id], d.[c], d.[n]
    from (values
        (N'150101',N'Lima',N'1501'),(N'150102',N'Ancon',N'1501'),(N'150103',N'Ate',N'1501'),
        (N'150104',N'Barranco',N'1501'),(N'150105',N'Breña',N'1501'),(N'150106',N'Carabayllo',N'1501'),
        (N'150107',N'Chaclacayo',N'1501'),(N'150108',N'Chorrillos',N'1501'),(N'150109',N'Cieneguilla',N'1501'),
        (N'150110',N'Comas',N'1501'),(N'150111',N'El Agustino',N'1501'),(N'150112',N'Independencia',N'1501'),
        (N'150113',N'Jesus Maria',N'1501'),(N'150114',N'La Molina',N'1501'),(N'150115',N'La Victoria',N'1501'),
        (N'150116',N'Lince',N'1501'),(N'150117',N'Los Olivos',N'1501'),(N'150118',N'Lurigancho',N'1501'),
        (N'150119',N'Lurin',N'1501'),(N'150120',N'Magdalena Del Mar',N'1501'),(N'150121',N'Pueblo Libre',N'1501'),
        (N'150122',N'Miraflores',N'1501'),(N'150123',N'Pachacamac',N'1501'),(N'150124',N'Pucusana',N'1501'),
        (N'150125',N'Puente Piedra',N'1501'),(N'150126',N'Punta Hermosa',N'1501'),(N'150127',N'Punta Negra',N'1501'),
        (N'150128',N'Rimac',N'1501'),(N'150129',N'San Bartolo',N'1501'),(N'150130',N'San Borja',N'1501'),
        (N'150131',N'San Isidro',N'1501'),(N'150132',N'San Juan De Lurigancho',N'1501'),
        (N'150133',N'San Juan De Miraflores',N'1501'),(N'150134',N'San Luis',N'1501'),
        (N'150135',N'San Martin De Porres',N'1501'),(N'150136',N'San Miguel',N'1501'),
        (N'150137',N'Santa Anita',N'1501'),(N'150138',N'Santa Maria Del Mar',N'1501'),
        (N'150139',N'Santa Rosa',N'1501'),(N'150140',N'Santiago De Surco',N'1501'),
        (N'150141',N'Surquillo',N'1501'),(N'150142',N'Villa El Salvador',N'1501'),
        (N'150143',N'Villa Maria Del Triunfo',N'1501')
    ) as d([c],[n],[prov])
    join [dbo].[Provinces] p on p.[CodigoSunat] = d.[prov];
end
go

-- Callao (0701) base districts
if not exists (select 1 from [dbo].[Districts] where [CodigoSunat] = N'070101')
begin
    insert into [dbo].[Districts] ([Id],[ProvinceId],[CodigoSunat],[Name])
    select newid(), p.[Id], d.[c], d.[n]
    from (values
        (N'070101',N'Callao',N'0701'),
        (N'070102',N'Bellavista',N'0701'),
        (N'070103',N'Carmen De La Legua Reynoso',N'0701'),
        (N'070104',N'La Perla',N'0701'),
        (N'070105',N'La Punta',N'0701'),
        (N'070106',N'Ventanilla',N'0701'),
        (N'070107',N'Mi Peru',N'0701')
    ) as d([c],[n],[prov])
    join [dbo].[Provinces] p on p.[CodigoSunat] = d.[prov];
end
go
if not exists (
    select 1
    from sys.indexes
    where name = N'IX_Products_Status_Category_Brand'
      and object_id = object_id(N'[dbo].[Products]')
)
    create index [IX_Products_Status_Category_Brand] on [dbo].[Products] ([Status], [CategoryId], [BrandId]);
go

if not exists (select 1 from sys.indexes where name = N'IX_Products_Price')
    create index [IX_Products_Price] on [dbo].[Products] ([SalePrice], [RegularPrice]);
go

if not exists (select 1 from sys.indexes where name = N'IX_Products_Name')
    create index [IX_Products_Name] on [dbo].[Products] ([Name]);
go

if not exists (select 1 from sys.indexes where name = N'IX_Variants_Color_Size')
    create index [IX_Variants_Color_Size] on [dbo].[ProductVariants] ([Color], [Size]);
go

merge [dbo].[Marca] as target
using (values
    (cast('11111111-1111-1111-1111-111111111111' as uniqueidentifier), N'Atelier Norte', N'atelier-norte'),
    (cast('22222222-2222-2222-2222-222222222222' as uniqueidentifier), N'Stride', N'stride')
) as source ([Id], [Name], [Slug])
on target.[Id] = source.[Id]
when not matched then insert ([Id], [Name], [Slug]) values (source.[Id], source.[Name], source.[Slug]);
go

if object_id(N'[dbo].[Brands]', N'U') is not null
begin
    insert into [dbo].[Marca] ([Id], [Name], [Slug], [LogoUrl], [IsActive], [CreatedAt], [UpdatedAt], [CreatedBy], [UpdatedBy], [IsDeleted])
    select [Id], [Name], [Slug], [LogoUrl], [IsActive], [CreatedAt], [UpdatedAt], [CreatedBy], [UpdatedBy], [IsDeleted]
    from [dbo].[Brands] oldBrand
    where not exists (select 1 from [dbo].[Marca] brand where brand.[Id] = oldBrand.[Id] or brand.[Slug] = oldBrand.[Slug]);
end
go

merge [dbo].[Categoria] as target
using (values
    (cast('33333333-3333-3333-3333-333333333333' as uniqueidentifier), N'Hombre', N'hombre'),
    (cast('44444444-4444-4444-4444-444444444444' as uniqueidentifier), N'Zapatillas', N'zapatillas'),
    (cast('55555555-5555-5555-5555-555555555555' as uniqueidentifier), N'Mujeres', N'mujeres'),
    (cast('66666666-6666-6666-6666-666666666666' as uniqueidentifier), N'Accesorios', N'accesorios')
) as source ([Id], [Name], [Slug])
on target.[Id] = source.[Id]
when matched then update set
    [Name] = source.[Name],
    [IsActive] = 1,
    [IsDeleted] = 0,
    [ParentId] = null
when not matched then insert ([Id], [Name], [Slug], [ParentId], [SortOrder], [IsActive], [IsDeleted]) values (source.[Id], source.[Name], source.[Slug], null, 0, 1, 0);
go

update [dbo].[Categoria]
set [SortOrder] = case [Slug]
    when N'hombre' then 0
    when N'mujeres' then 1
    when N'zapatillas' then 2
    when N'accesorios' then 3
    else [SortOrder]
end
where [ParentId] is null
  and [Slug] in (N'hombre', N'mujeres', N'zapatillas', N'accesorios');
go

if object_id(N'[dbo].[Categories]', N'U') is not null
begin
    if col_length('dbo.Categories', 'SortOrder') is null
    begin
        insert into [dbo].[Categoria] ([Id], [Name], [Slug], [Description], [ImageUrl], [ParentId], [IsActive], [CreatedAt], [UpdatedAt], [CreatedBy], [UpdatedBy], [IsDeleted], [SortOrder])
        select [Id], [Name], [Slug], [Description], [ImageUrl], [ParentId], [IsActive], [CreatedAt], [UpdatedAt], [CreatedBy], [UpdatedBy], [IsDeleted], 0
        from [dbo].[Categories] oldCategory
        where not exists (select 1 from [dbo].[Categoria] category where category.[Id] = oldCategory.[Id] or category.[Slug] = oldCategory.[Slug]);
    end
    else
    begin
        exec(N'
            insert into [dbo].[Categoria] ([Id], [Name], [Slug], [Description], [ImageUrl], [ParentId], [IsActive], [CreatedAt], [UpdatedAt], [CreatedBy], [UpdatedBy], [IsDeleted], [SortOrder])
            select [Id], [Name], [Slug], [Description], [ImageUrl], [ParentId], [IsActive], [CreatedAt], [UpdatedAt], [CreatedBy], [UpdatedBy], [IsDeleted], [SortOrder]
            from [dbo].[Categories] oldCategory
            where not exists (select 1 from [dbo].[Categoria] category where category.[Id] = oldCategory.[Id] or category.[Slug] = oldCategory.[Slug]);
        ');
    end
end
go

merge [dbo].[Users] as target
using (values
    (cast('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' as uniqueidentifier), N'admin@ecommerce.local', N'100000.MDEyMzQ1Njc4OWFiY2RlZg==.x5PgGELHeFjERkv+IooGuqzC2YCKhB/vSsFF3f7/3X4=', N'Administrador Ecommerce', 1)
) as source ([Id], [Email], [PasswordHash], [FullName], [Role])
on target.[Email] = source.[Email]
when matched then update set
    [PasswordHash] = source.[PasswordHash],
    [FullName] = source.[FullName],
    [Role] = source.[Role],
    [IsActive] = 1,
    [IsDeleted] = 0,
    [UpdatedAt] = sysdatetimeoffset()
when not matched then insert ([Id], [Email], [PasswordHash], [FullName], [Role], [IsActive]) values (source.[Id], source.[Email], source.[PasswordHash], source.[FullName], source.[Role], 1);
go

if object_id(N'[dbo].[StoreSettings]', N'U') is null
begin
    create table [dbo].[StoreSettings] (
        [Id] uniqueidentifier not null primary key,
        [CompanyRuc] nvarchar(20) not null default N'20613512277',
        [CompanyBusinessName] nvarchar(180) not null default N'Ecommerce E.I.R.L',
        [CompanyAddress] nvarchar(280) not null default N'Direccion pendiente',
        [CompanyPhone] nvarchar(40) not null default N'+51 937211721',
        [CompanyEmail] nvarchar(256) not null default N'descoaostv@gmail.com',
        [FreeShippingLima] bit not null default 1,
        [ProvinceShippingCost] decimal(18,2) not null default 15.00,
        [ActiveTaxType] nvarchar(10) not null default N'IGV',
        [IgvRate] decimal(5,2) not null default 18.00,
        [IvaRate] decimal(5,2) not null default 12.00,
        [TaxIncludedInPrice] bit not null default 1,
        [PaymentGatewayEnabled] bit not null default 0,
        [YapeApiKey] nvarchar(max) null,
        [YapeSecretKey] nvarchar(max) null,
        [YapeMerchantId] nvarchar(max) null,
        [YapeWebhookSecret] nvarchar(max) null,
        [CardPublicKey] nvarchar(max) null,
        [CardSecretKey] nvarchar(max) null,
        [CardWebhookSecret] nvarchar(max) null,
        [CardProvider] nvarchar(30) null,
        [OrderNotificationEmail] nvarchar(256) not null default N'jfernandez-20@hotmail.com',
        [SmtpHost] nvarchar(180) null,
        [SmtpPort] int not null default 587,
        [SmtpUser] nvarchar(256) null,
        [SmtpPassword] nvarchar(max) null,
        [SmtpUseSsl] bit not null default 1,
        [SmtpFromEmail] nvarchar(256) null,
        [SmtpFromName] nvarchar(120) null,
        [SunatSolUser] nvarchar(120) null,
        [SunatSolPassword] nvarchar(120) null,
        [SunatCertificateFileName] nvarchar(260) null,
        [SunatCertificatePassword] nvarchar(120) null,
        [SunatCertificateBase64] nvarchar(max) null,
        [SunatServiceEndpoint] nvarchar(400) null,
        [SunatEnvironment] nvarchar(20) not null default N'development',
        [SunatEstablishmentCode] nvarchar(4) not null default N'0000',
        [SunatReceiptSeries] nvarchar(10) not null default N'B001',
        [SunatInvoiceSeries] nvarchar(10) not null default N'F001',
        [SunatReceiptNextCorrelative] int not null default 1,
        [SunatInvoiceNextCorrelative] int not null default 1,
        [WhatsAppEnabled] bit not null default 0,
        [WhatsAppApiUrl] nvarchar(260) null,
        [WhatsAppApiVersion] nvarchar(20) null,
        [WhatsAppApiKey] nvarchar(max) null,
        [WhatsAppSecretKey] nvarchar(max) null,
        [WhatsAppPhoneNumberId] nvarchar(80) null,
        [WhatsAppDefaultCountryCode] nvarchar(6) null,
        [WhatsAppConfirmTemplate] nvarchar(1200) null,
        [WhatsAppRejectTemplate] nvarchar(1200) null,
        [CreatedAt] datetimeoffset not null default sysutcdatetime(),
        [UpdatedAt] datetimeoffset null,
        [CreatedBy] nvarchar(max) null,
        [UpdatedBy] nvarchar(max) null,
        [IsDeleted] bit not null default 0
    );
end
go

if col_length('dbo.StoreSettings', 'CompanyRuc') is null
begin
    alter table [dbo].[StoreSettings] add [CompanyRuc] nvarchar(20) not null constraint [DF_StoreSettings_CompanyRuc] default N'20613512277';
end
go

if col_length('dbo.StoreSettings', 'CompanyBusinessName') is null
begin
    alter table [dbo].[StoreSettings] add [CompanyBusinessName] nvarchar(180) not null constraint [DF_StoreSettings_CompanyBusinessName] default N'Descosale E.I.R.L';
end
go

if col_length('dbo.StoreSettings', 'StoreName') is null
begin
    alter table [dbo].[StoreSettings] add [StoreName] nvarchar(50) not null constraint [DF_StoreSettings_StoreName] default N'Ecommerce';
end
go

if col_length('dbo.StoreSettings', 'CompanyAddress') is null
begin
    alter table [dbo].[StoreSettings] add [CompanyAddress] nvarchar(280) not null constraint [DF_StoreSettings_CompanyAddress] default N'Direccion pendiente';
end
go

if col_length('dbo.StoreSettings', 'CompanyPhone') is null
begin
    alter table [dbo].[StoreSettings] add [CompanyPhone] nvarchar(40) not null constraint [DF_StoreSettings_CompanyPhone] default N'+51 937211721';
end
go

if col_length('dbo.StoreSettings', 'CompanyEmail') is null
begin
    alter table [dbo].[StoreSettings] add [CompanyEmail] nvarchar(256) not null constraint [DF_StoreSettings_CompanyEmail] default N'descoaostv@gmail.com';
end
go

if col_length('dbo.StoreSettings', 'ActiveTaxType') is null
begin
    alter table [dbo].[StoreSettings] add [ActiveTaxType] nvarchar(10) not null constraint [DF_StoreSettings_ActiveTaxType] default N'IGV' with values;
end
go

if col_length('dbo.StoreSettings', 'IgvRate') is null
begin
    alter table [dbo].[StoreSettings] add [IgvRate] decimal(5,2) not null constraint [DF_StoreSettings_IgvRate] default 18.00 with values;
end
go

if col_length('dbo.StoreSettings', 'IvaRate') is null
begin
    alter table [dbo].[StoreSettings] add [IvaRate] decimal(5,2) not null constraint [DF_StoreSettings_IvaRate] default 12.00 with values;
end
go

if col_length('dbo.StoreSettings', 'TaxIncludedInPrice') is null
begin
    alter table [dbo].[StoreSettings] add [TaxIncludedInPrice] bit not null constraint [DF_StoreSettings_TaxIncludedInPrice] default 1 with values;
end
go

if col_length('dbo.StoreSettings', 'SmtpHost') is null
begin
    alter table [dbo].[StoreSettings] add [SmtpHost] nvarchar(180) null;
end
go

if col_length('dbo.StoreSettings', 'SmtpPort') is null
begin
    alter table [dbo].[StoreSettings] add [SmtpPort] int not null constraint [DF_StoreSettings_SmtpPort] default 587;
end
go

if col_length('dbo.StoreSettings', 'SmtpUser') is null
begin
    alter table [dbo].[StoreSettings] add [SmtpUser] nvarchar(256) null;
end
go

if col_length('dbo.StoreSettings', 'SmtpPassword') is null
begin
    alter table [dbo].[StoreSettings] add [SmtpPassword] nvarchar(max) null;
end
go

if col_length('dbo.StoreSettings', 'SmtpUseSsl') is null
begin
    alter table [dbo].[StoreSettings] add [SmtpUseSsl] bit not null constraint [DF_StoreSettings_SmtpUseSsl] default 1;
end
go

if col_length('dbo.StoreSettings', 'SmtpFromEmail') is null
begin
    alter table [dbo].[StoreSettings] add [SmtpFromEmail] nvarchar(256) null;
end
go

if col_length('dbo.StoreSettings', 'SmtpFromName') is null
begin
    alter table [dbo].[StoreSettings] add [SmtpFromName] nvarchar(120) null;
end
go

if col_length('dbo.StoreSettings', 'SunatSolUser') is null
begin
    alter table [dbo].[StoreSettings] add [SunatSolUser] nvarchar(120) null;
end
go

if col_length('dbo.StoreSettings', 'SunatSolPassword') is null
begin
    alter table [dbo].[StoreSettings] add [SunatSolPassword] nvarchar(120) null;
end
go

if col_length('dbo.StoreSettings', 'SunatCertificateFileName') is null
begin
    alter table [dbo].[StoreSettings] add [SunatCertificateFileName] nvarchar(260) null;
end
go

if col_length('dbo.StoreSettings', 'SunatCertificatePassword') is null
begin
    alter table [dbo].[StoreSettings] add [SunatCertificatePassword] nvarchar(120) null;
end
go

if col_length('dbo.StoreSettings', 'SunatCertificateBase64') is null
begin
    alter table [dbo].[StoreSettings] add [SunatCertificateBase64] nvarchar(max) null;
end
go

if col_length('dbo.StoreSettings', 'SunatServiceEndpoint') is null
begin
    alter table [dbo].[StoreSettings] add [SunatServiceEndpoint] nvarchar(400) null;
end
go

if col_length('dbo.StoreSettings', 'SunatEstablishmentCode') is null
begin
    alter table [dbo].[StoreSettings] add [SunatEstablishmentCode] nvarchar(4) not null constraint [DF_StoreSettings_SunatEstablishmentCode] default N'0000' with values;
end
go

if col_length('dbo.StoreSettings', 'SunatEnvironment') is null
begin
    alter table [dbo].[StoreSettings] add [SunatEnvironment] nvarchar(20) not null constraint [DF_StoreSettings_SunatEnvironment] default N'development';
end
go

if col_length('dbo.StoreSettings', 'SunatReceiptSeries') is null
begin
    alter table [dbo].[StoreSettings] add [SunatReceiptSeries] nvarchar(10) not null constraint [DF_StoreSettings_SunatReceiptSeries] default N'B001';
end
go

if col_length('dbo.StoreSettings', 'SunatInvoiceSeries') is null
begin
    alter table [dbo].[StoreSettings] add [SunatInvoiceSeries] nvarchar(10) not null constraint [DF_StoreSettings_SunatInvoiceSeries] default N'F001';
end
go

if col_length('dbo.StoreSettings', 'SunatReceiptNextCorrelative') is null
begin
    alter table [dbo].[StoreSettings] add [SunatReceiptNextCorrelative] int not null constraint [DF_StoreSettings_SunatReceiptNextCorrelative] default 1;
end
go

if col_length('dbo.StoreSettings', 'SunatInvoiceNextCorrelative') is null
begin
    alter table [dbo].[StoreSettings] add [SunatInvoiceNextCorrelative] int not null constraint [DF_StoreSettings_SunatInvoiceNextCorrelative] default 1;
end
go

if col_length('dbo.StoreSettings', 'WhatsAppEnabled') is null
begin
    alter table [dbo].[StoreSettings] add [WhatsAppEnabled] bit not null constraint [DF_StoreSettings_WhatsAppEnabled] default 0;
end
go

if col_length('dbo.StoreSettings', 'WhatsAppApiUrl') is null
begin
    alter table [dbo].[StoreSettings] add [WhatsAppApiUrl] nvarchar(260) null;
end
go

if col_length('dbo.StoreSettings', 'WhatsAppApiVersion') is null
begin
    alter table [dbo].[StoreSettings] add [WhatsAppApiVersion] nvarchar(20) null;
end
go

if col_length('dbo.StoreSettings', 'WhatsAppApiKey') is null
begin
    alter table [dbo].[StoreSettings] add [WhatsAppApiKey] nvarchar(max) null;
end
go

if col_length('dbo.StoreSettings', 'WhatsAppSecretKey') is null
begin
    alter table [dbo].[StoreSettings] add [WhatsAppSecretKey] nvarchar(max) null;
end
go

if col_length('dbo.StoreSettings', 'WhatsAppPhoneNumberId') is null
begin
    alter table [dbo].[StoreSettings] add [WhatsAppPhoneNumberId] nvarchar(80) null;
end
go

if col_length('dbo.StoreSettings', 'WhatsAppDefaultCountryCode') is null
begin
    alter table [dbo].[StoreSettings] add [WhatsAppDefaultCountryCode] nvarchar(6) null;
end
go

if col_length('dbo.StoreSettings', 'WhatsAppConfirmTemplate') is null
begin
    alter table [dbo].[StoreSettings] add [WhatsAppConfirmTemplate] nvarchar(1200) null;
end
go

if col_length('dbo.StoreSettings', 'WhatsAppRejectTemplate') is null
begin
    alter table [dbo].[StoreSettings] add [WhatsAppRejectTemplate] nvarchar(1200) null;
end
go

if object_id(N'[dbo].[Wishlist]', N'U') is null
begin
    create table [dbo].[Wishlist] (
        [Id] uniqueidentifier not null primary key,
        [CustomerId] uniqueidentifier null,
        [CustomerEmail] nvarchar(256) not null,
        [CreatedAt] datetimeoffset not null default sysutcdatetime(),
        [UpdatedAt] datetimeoffset null,
        [CreatedBy] nvarchar(max) null,
        [UpdatedBy] nvarchar(max) null,
        [IsDeleted] bit not null default 0,
        constraint [IX_Wishlist_Email] unique ([CustomerEmail])
    );
end
go

if object_id(N'[dbo].[ClaimBookEntries]', N'U') is null
begin
    create table [dbo].[ClaimBookEntries] (
        [Id] uniqueidentifier not null primary key,
        [Code] nvarchar(40) not null,
        [FirstName] nvarchar(120) not null,
        [LastName] nvarchar(120) not null,
        [DocumentType] nvarchar(30) not null,
        [DocumentNumber] nvarchar(20) not null,
        [ResponseChannel] nvarchar(50) not null,
        [Email] nvarchar(256) not null,
        [Address] nvarchar(240) not null,
        [Phone] nvarchar(30) null,
        [IsMinor] bit not null default 0,
        [ContractedGoodType] nvarchar(40) not null,
        [OrderNumber] nvarchar(40) null,
        [ClaimedAmount] decimal(18,2) null,
        [GoodDescription] nvarchar(max) not null,
        [ClaimType] nvarchar(30) not null,
        [ClaimDetail] nvarchar(max) not null,
        [ConsumerRequest] nvarchar(max) not null,
        [AcceptedTerms] bit not null,
        [CreatedAt] datetimeoffset not null default sysutcdatetime(),
        [UpdatedAt] datetimeoffset null,
        [CreatedBy] nvarchar(max) null,
        [UpdatedBy] nvarchar(max) null,
        [IsDeleted] bit not null default 0,
        constraint [UX_ClaimBookEntries_Code] unique ([Code])
    );
end
go

if object_id(N'[dbo].[WishlistItem]', N'U') is null
begin
    create table [dbo].[WishlistItem] (
        [Id] uniqueidentifier not null primary key,
        [WishlistId] uniqueidentifier not null,
        [ProductId] uniqueidentifier not null,
        [CreatedAt] datetimeoffset not null default sysutcdatetime(),
        [UpdatedAt] datetimeoffset null,
        [CreatedBy] nvarchar(max) null,
        [UpdatedBy] nvarchar(max) null,
        [IsDeleted] bit not null default 0,
        constraint [FK_WishlistItem_Wishlist] foreign key ([WishlistId]) references [dbo].[Wishlist]([Id]) on delete cascade,
        constraint [FK_WishlistItem_Product] foreign key ([ProductId]) references [dbo].[Products]([Id]) on delete cascade,
        constraint [UX_WishlistItem_Unique] unique ([WishlistId], [ProductId])
    );
end
go

if object_id(N'[dbo].[StoreLocations]', N'U') is null
begin
    create table [dbo].[StoreLocations] (
        [Id] uniqueidentifier not null primary key,
        [Name] nvarchar(180) not null,
        [Code] nvarchar(50) not null,
        [Address] nvarchar(260) not null,
        [District] nvarchar(160) null,
        [Province] nvarchar(140) null,
        [Department] nvarchar(120) null,
        [Phone] nvarchar(30) null,
        [PickupInstructions] nvarchar(400) null,
        [IsActive] bit not null default 1,
        [CreatedAt] datetimeoffset not null default sysutcdatetime(),
        [UpdatedAt] datetimeoffset null,
        [CreatedBy] nvarchar(max) null,
        [UpdatedBy] nvarchar(max) null,
        [IsDeleted] bit not null default 0,
        constraint [UX_StoreLocations_Code] unique ([Code])
    );
end
go

if object_id(N'[dbo].[ProductStoreStocks]', N'U') is null
begin
    create table [dbo].[ProductStoreStocks] (
        [Id] uniqueidentifier not null primary key,
        [StoreId] uniqueidentifier not null,
        [ProductId] uniqueidentifier not null,
        [Stock] int not null default 0,
        [CreatedAt] datetimeoffset not null default sysutcdatetime(),
        [UpdatedAt] datetimeoffset null,
        [CreatedBy] nvarchar(max) null,
        [UpdatedBy] nvarchar(max) null,
        [IsDeleted] bit not null default 0,
        constraint [FK_ProductStoreStocks_Store] foreign key ([StoreId]) references [dbo].[StoreLocations]([Id]) on delete cascade,
        constraint [FK_ProductStoreStocks_Product] foreign key ([ProductId]) references [dbo].[Products]([Id]) on delete cascade,
        constraint [UX_ProductStoreStocks_Store_Product] unique ([StoreId], [ProductId])
    );
end
go

if col_length('dbo.Products', 'MainStoreId') is null
begin
    alter table [dbo].[Products] add [MainStoreId] uniqueidentifier null;
end
go

if col_length('dbo.InventoryMovements', 'StoreId') is null
begin
    alter table [dbo].[InventoryMovements] add [StoreId] uniqueidentifier null;
end
go

if col_length('dbo.Orders', 'StoreId') is null
begin
    alter table [dbo].[Orders] add [StoreId] uniqueidentifier null;
end
go

if col_length('dbo.Orders', 'StoreName') is null
begin
    alter table [dbo].[Orders] add [StoreName] nvarchar(180) null;
end
go

if col_length('dbo.Orders', 'FulfillmentType') is null
begin
    alter table [dbo].[Orders] add [FulfillmentType] int not null constraint [DF_Orders_FulfillmentType] default 0 with values;
end
go

if col_length('dbo.Sales', 'StoreId') is null
begin
    alter table [dbo].[Sales] add [StoreId] uniqueidentifier null;
end
go

if col_length('dbo.Sales', 'StoreName') is null
begin
    alter table [dbo].[Sales] add [StoreName] nvarchar(180) null;
end
go

if exists (select 1 from [dbo].[StoreLocations])
begin
    if exists (select 1 from [dbo].[Products] where [MainStoreId] is null)
    begin
        declare @DefaultStoreId uniqueidentifier;
        select top 1 @DefaultStoreId = [Id] from [dbo].[StoreLocations] where [IsActive] = 1 order by [CreatedAt];

        if @DefaultStoreId is null
            select top 1 @DefaultStoreId = [Id] from [dbo].[StoreLocations] order by [CreatedAt];

        update [dbo].[Products]
        set [MainStoreId] = @DefaultStoreId
        where [MainStoreId] is null;
    end
end
go

if not exists (select 1 from sys.foreign_keys where name = N'FK_Products_MainStore')
begin
    alter table [dbo].[Products]
    with check add constraint [FK_Products_MainStore] foreign key ([MainStoreId]) references [dbo].[StoreLocations]([Id]);
end
go

if not exists (select 1 from sys.foreign_keys where name = N'FK_InventoryMovements_Store')
begin
    alter table [dbo].[InventoryMovements]
    with check add constraint [FK_InventoryMovements_Store] foreign key ([StoreId]) references [dbo].[StoreLocations]([Id]);
end
go

if not exists (select 1 from sys.foreign_keys where name = N'FK_Orders_Store')
begin
    alter table [dbo].[Orders]
    with check add constraint [FK_Orders_Store] foreign key ([StoreId]) references [dbo].[StoreLocations]([Id]);
end
go

if not exists (select 1 from sys.foreign_keys where name = N'FK_Sales_Store')
begin
    alter table [dbo].[Sales]
    with check add constraint [FK_Sales_Store] foreign key ([StoreId]) references [dbo].[StoreLocations]([Id]);
end
go

if not exists (select 1 from sys.indexes where name = N'IX_Products_MainStoreId')
    create index [IX_Products_MainStoreId] on [dbo].[Products] ([MainStoreId]);
go

if not exists (select 1 from sys.indexes where name = N'IX_InventoryMovements_StoreId_CreatedAt')
    create index [IX_InventoryMovements_StoreId_CreatedAt] on [dbo].[InventoryMovements] ([StoreId], [CreatedAt] desc);
go

if not exists (select 1 from sys.indexes where name = N'IX_Orders_StoreId')
    create index [IX_Orders_StoreId] on [dbo].[Orders] ([StoreId]);
go

if not exists (select 1 from sys.indexes where name = N'IX_Sales_StoreId')
    create index [IX_Sales_StoreId] on [dbo].[Sales] ([StoreId]);
go
