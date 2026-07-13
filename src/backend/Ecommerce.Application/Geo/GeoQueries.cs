using MediatR;

namespace Ecommerce.Application.Geo;

// ─── DTOs ────────────────────────────────────────────────────────────────────

public sealed record DepartmentDto(Guid Id, string Code, string Name);
public sealed record ProvinceDto(Guid Id, Guid DepartmentId, string Code, string Name);
public sealed record DistrictDto(Guid Id, Guid ProvinceId, string Code, string Name);

// ─── Queries ─────────────────────────────────────────────────────────────────

public sealed record GetDepartmentsQuery : IRequest<IReadOnlyList<DepartmentDto>>;
public sealed record GetProvincesQuery(Guid DepartmentId) : IRequest<IReadOnlyList<ProvinceDto>>;
public sealed record GetDistrictsQuery(Guid ProvinceId) : IRequest<IReadOnlyList<DistrictDto>>;
