using Asp.Versioning;
using Ecommerce.Application.Geo;
using Ecommerce.Application.Settings;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ecommerce.Api.Controllers.V1;

[ApiController]
[ApiVersion(1)]
[AllowAnonymous]
[Route("api/v{version:apiVersion}/geo")]
public sealed class GeoController(ISender sender) : ControllerBase
{
    [HttpGet("departments")]
    public Task<IReadOnlyList<DepartmentDto>> GetDepartments(CancellationToken cancellationToken) =>
        sender.Send(new GetDepartmentsQuery(), cancellationToken);

    [HttpGet("departments/{departmentId:guid}/provinces")]
    public Task<IReadOnlyList<ProvinceDto>> GetProvinces(Guid departmentId, CancellationToken cancellationToken) =>
        sender.Send(new GetProvincesQuery(departmentId), cancellationToken);

    [HttpGet("provinces/{provinceId:guid}/districts")]
    public Task<IReadOnlyList<DistrictDto>> GetDistricts(Guid provinceId, CancellationToken cancellationToken) =>
        sender.Send(new GetDistrictsQuery(provinceId), cancellationToken);
}
