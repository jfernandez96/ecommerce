namespace Ecommerce.Domain.Common;

public sealed class Department
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string CodigoSunat { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public ICollection<Province> Provinces { get; set; } = [];
}

public sealed class Province
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DepartmentId { get; set; }
    public string CodigoSunat { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public Department Department { get; set; } = null!;
    public ICollection<District> Districts { get; set; } = [];
}

public sealed class District
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProvinceId { get; set; }
    public string CodigoSunat { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public Province Province { get; set; } = null!;
}
