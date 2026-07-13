set nocount on;
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