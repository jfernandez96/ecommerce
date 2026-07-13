using Dapper;
using Ecommerce.Application.Geo;
using MediatR;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace Ecommerce.Infrastructure.Persistence;

public sealed class GetDepartmentsQueryHandler(IConfiguration configuration)
    : IRequestHandler<GetDepartmentsQuery, IReadOnlyList<DepartmentDto>>
{
    public async Task<IReadOnlyList<DepartmentDto>> Handle(GetDepartmentsQuery request, CancellationToken cancellationToken)
    {
        await using var connection = new SqlConnection(configuration.GetConnectionString("SqlServer"));
        var rows = await connection.QueryAsync<(Guid Id, string CodigoSunat, string Name)>(
            "select [Id], [CodigoSunat], [Name] from [Departments] where [IsActive] = 1 order by [Name]");
        return rows.Select(r => new DepartmentDto(r.Id, r.CodigoSunat, r.Name)).ToArray();
    }
}

public sealed class GetProvincesQueryHandler(IConfiguration configuration)
    : IRequestHandler<GetProvincesQuery, IReadOnlyList<ProvinceDto>>
{
    public async Task<IReadOnlyList<ProvinceDto>> Handle(GetProvincesQuery request, CancellationToken cancellationToken)
    {
        await using var connection = new SqlConnection(configuration.GetConnectionString("SqlServer"));
        var rows = await connection.QueryAsync<(Guid Id, Guid DepartmentId, string CodigoSunat, string Name)>(
            "select [Id], [DepartmentId], [CodigoSunat], [Name] from [Provinces] where [DepartmentId] = @DepartmentId and [IsActive] = 1 order by [Name]",
            new { request.DepartmentId });
        return rows.Select(r => new ProvinceDto(r.Id, r.DepartmentId, r.CodigoSunat, r.Name)).ToArray();
    }
}

public sealed class GetDistrictsQueryHandler(IConfiguration configuration)
    : IRequestHandler<GetDistrictsQuery, IReadOnlyList<DistrictDto>>
{
    public async Task<IReadOnlyList<DistrictDto>> Handle(GetDistrictsQuery request, CancellationToken cancellationToken)
    {
        await using var connection = new SqlConnection(configuration.GetConnectionString("SqlServer"));
        var rows = await connection.QueryAsync<(Guid Id, Guid ProvinceId, string CodigoSunat, string Name)>(
            "select [Id], [ProvinceId], [CodigoSunat], [Name] from [Districts] where [ProvinceId] = @ProvinceId and [IsActive] = 1 order by [Name]",
            new { request.ProvinceId });
        return rows.Select(r => new DistrictDto(r.Id, r.ProvinceId, r.CodigoSunat, r.Name)).ToArray();
    }
}
