set nocount on;
set xact_abort on;
go

begin transaction;

if object_id(N'[dbo].[Marca]', N'U') is null
begin
    create table [dbo].[Marca] (
        [Id] uniqueidentifier not null constraint [PK_Marca] primary key,
        [Name] nvarchar(160) not null,
        [Slug] nvarchar(180) not null,
        [LogoUrl] nvarchar(600) null,
        [IsActive] bit not null constraint [DF_Marca_IsActive] default 1,
        [CreatedAt] datetimeoffset not null constraint [DF_Marca_CreatedAt] default sysdatetimeoffset(),
        [UpdatedAt] datetimeoffset null,
        [CreatedBy] nvarchar(120) null,
        [UpdatedBy] nvarchar(120) null,
        [IsDeleted] bit not null constraint [DF_Marca_IsDeleted] default 0,
        constraint [UX_Marca_Slug] unique ([Slug])
    );
end;

if object_id(N'[dbo].[Categoria]', N'U') is null
begin
    create table [dbo].[Categoria] (
        [Id] uniqueidentifier not null constraint [PK_Categoria] primary key,
        [Name] nvarchar(160) not null,
        [Slug] nvarchar(180) not null,
        [Description] nvarchar(800) null,
        [ImageUrl] nvarchar(600) null,
        [ParentId] uniqueidentifier null,
        [IsActive] bit not null constraint [DF_Categoria_IsActive] default 1,
        [SortOrder] int not null constraint [DF_Categoria_SortOrder] default 0,
        [CreatedAt] datetimeoffset not null constraint [DF_Categoria_CreatedAt] default sysdatetimeoffset(),
        [UpdatedAt] datetimeoffset null,
        [CreatedBy] nvarchar(120) null,
        [UpdatedBy] nvarchar(120) null,
        [IsDeleted] bit not null constraint [DF_Categoria_IsDeleted] default 0,
        constraint [UX_Categoria_Slug] unique ([Slug]),
        constraint [FK_Categoria_Parent] foreign key ([ParentId]) references [dbo].[Categoria]([Id])
    );
end;

if object_id(N'[dbo].[Brands]', N'U') is not null
begin
    insert into [dbo].[Marca] ([Id], [Name], [Slug], [LogoUrl], [IsActive], [CreatedAt], [UpdatedAt], [CreatedBy], [UpdatedBy], [IsDeleted])
    select [Id], [Name], [Slug], [LogoUrl], [IsActive], [CreatedAt], [UpdatedAt], [CreatedBy], [UpdatedBy], [IsDeleted]
    from [dbo].[Brands] oldBrand
    where not exists (select 1 from [dbo].[Marca] brand where brand.[Id] = oldBrand.[Id] or brand.[Slug] = oldBrand.[Slug]);
end;

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
    end;
end;

declare @dropOldForeignKeys nvarchar(max) = N'';

select @dropOldForeignKeys += N'alter table ' + quotename(object_schema_name(fk.parent_object_id)) + N'.' + quotename(object_name(fk.parent_object_id)) + N' drop constraint ' + quotename(fk.name) + N';' + char(13)
from sys.foreign_keys fk
where fk.referenced_object_id in (object_id(N'[dbo].[Brands]'), object_id(N'[dbo].[Categories]'));

if @dropOldForeignKeys <> N''
begin
    exec sp_executesql @dropOldForeignKeys;
end;

if object_id(N'[dbo].[Products]', N'U') is not null
begin
    if not exists (select 1 from sys.foreign_keys where name = N'FK_Products_Marca' and parent_object_id = object_id(N'[dbo].[Products]'))
    begin
        alter table [dbo].[Products] with check add constraint [FK_Products_Marca] foreign key ([BrandId]) references [dbo].[Marca]([Id]);
    end;

    if not exists (select 1 from sys.foreign_keys where name = N'FK_Products_Categoria' and parent_object_id = object_id(N'[dbo].[Products]'))
    begin
        alter table [dbo].[Products] with check add constraint [FK_Products_Categoria] foreign key ([CategoryId]) references [dbo].[Categoria]([Id]);
    end;

    if col_length('dbo.Products', 'SubcategoryId') is not null
       and not exists (select 1 from sys.foreign_keys where name = N'FK_Products_Subcategoria' and parent_object_id = object_id(N'[dbo].[Products]'))
    begin
        alter table [dbo].[Products] with check add constraint [FK_Products_Subcategoria] foreign key ([SubcategoryId]) references [dbo].[Categoria]([Id]);
    end;
end;

if object_id(N'[dbo].[Promotions]', N'U') is not null
begin
    if col_length('dbo.Promotions', 'CategoryId') is not null
       and not exists (select 1 from sys.foreign_keys where name = N'FK_Promotions_Categoria' and parent_object_id = object_id(N'[dbo].[Promotions]'))
    begin
        alter table [dbo].[Promotions] with check add constraint [FK_Promotions_Categoria] foreign key ([CategoryId]) references [dbo].[Categoria]([Id]);
    end;

    if col_length('dbo.Promotions', 'BrandId') is not null
       and not exists (select 1 from sys.foreign_keys where name = N'FK_Promotions_Marca' and parent_object_id = object_id(N'[dbo].[Promotions]'))
    begin
        alter table [dbo].[Promotions] with check add constraint [FK_Promotions_Marca] foreign key ([BrandId]) references [dbo].[Marca]([Id]);
    end;
end;

if object_id(N'[dbo].[Categories]', N'U') is not null
begin
    drop table [dbo].[Categories];
end;

if object_id(N'[dbo].[Brands]', N'U') is not null
begin
    drop table [dbo].[Brands];
end;

commit transaction;
go