using Ecommerce.Application.Common;
using Ecommerce.Domain.Catalog;
using FluentValidation;
using MediatR;

namespace Ecommerce.Application.Categories;

public sealed record ListCategoriesQuery : IRequest<IReadOnlyList<CategoryDto>>;
public sealed record GetCategoryQuery(Guid Id) : IRequest<CategoryDto?>;
public sealed record CreateCategoryCommand(string Name, string Slug, string? Description, string? ImageUrl, int SortOrder, Guid? ParentId, bool IsActive) : IRequest<Guid>;
public sealed record UpdateCategoryCommand(Guid Id, string Name, string Slug, string? Description, string? ImageUrl, int SortOrder, Guid? ParentId, bool IsActive) : IRequest<bool>;
public sealed record DeleteCategoryCommand(Guid Id) : IRequest<bool>;
public sealed record SetCategoryStatusCommand(Guid Id, bool IsActive) : IRequest<bool>;

public sealed class CreateCategoryCommandValidator : AbstractValidator<CreateCategoryCommand>
{
    public CreateCategoryCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(140);
        RuleFor(x => x.Slug).NotEmpty().MaximumLength(180).Matches("^[a-z0-9]+(?:-[a-z0-9]+)*$");
        RuleFor(x => x.SortOrder).GreaterThanOrEqualTo(0);
    }
}

public sealed class UpdateCategoryCommandValidator : AbstractValidator<UpdateCategoryCommand>
{
    public UpdateCategoryCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(140);
        RuleFor(x => x.Slug).NotEmpty().MaximumLength(180).Matches("^[a-z0-9]+(?:-[a-z0-9]+)*$");
        RuleFor(x => x.SortOrder).GreaterThanOrEqualTo(0);
    }
}

public sealed class ListCategoriesQueryHandler(ICategoryRepository categories) : IRequestHandler<ListCategoriesQuery, IReadOnlyList<CategoryDto>>
{
    public async Task<IReadOnlyList<CategoryDto>> Handle(ListCategoriesQuery request, CancellationToken cancellationToken) =>
        (await categories.ListAsync(cancellationToken)).OrderBy(x => x.SortOrder).ThenBy(x => x.Name).Select(ToDto).ToArray();

    private static CategoryDto ToDto(Category category) => new(category.Id, category.Name, category.Slug, category.Description, category.ImageUrl, category.IsActive, category.SortOrder, category.ParentId, category.CreatedAt);
}

public sealed class GetCategoryQueryHandler(ICategoryRepository categories) : IRequestHandler<GetCategoryQuery, CategoryDto?>
{
    public async Task<CategoryDto?> Handle(GetCategoryQuery request, CancellationToken cancellationToken)
    {
        var category = await categories.GetByIdAsync(request.Id, cancellationToken);
        return category is null ? null : new CategoryDto(category.Id, category.Name, category.Slug, category.Description, category.ImageUrl, category.IsActive, category.SortOrder, category.ParentId, category.CreatedAt);
    }
}

public sealed class CreateCategoryCommandHandler(ICategoryRepository categories, IUnitOfWork unitOfWork) : IRequestHandler<CreateCategoryCommand, Guid>
{
    public async Task<Guid> Handle(CreateCategoryCommand request, CancellationToken cancellationToken)
    {
        if (request.ParentId is not null)
        {
            var parent = await categories.GetByIdAsync(request.ParentId.Value, cancellationToken);
            if (parent is null)
            {
                throw new ValidationException("La seccion principal seleccionada no existe.");
            }

            if (parent.ParentId is not null)
            {
                throw new ValidationException("La categoria padre debe ser una opcion principal del menu.");
            }
        }

        var category = new Category { Name = request.Name, Slug = request.Slug, Description = request.Description, ImageUrl = request.ImageUrl, SortOrder = request.SortOrder, ParentId = request.ParentId, IsActive = request.IsActive };
        await categories.AddAsync(category, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return category.Id;
    }
}

public sealed class UpdateCategoryCommandHandler(ICategoryRepository categories, IUnitOfWork unitOfWork) : IRequestHandler<UpdateCategoryCommand, bool>
{
    public async Task<bool> Handle(UpdateCategoryCommand request, CancellationToken cancellationToken)
    {
        var category = await categories.GetByIdAsync(request.Id, cancellationToken);
        if (category is null) return false;

        if (request.ParentId == request.Id)
        {
            throw new ValidationException("Una categoria no puede ser su propia categoria padre.");
        }

        if (request.ParentId is not null)
        {
            var parent = await categories.GetByIdAsync(request.ParentId.Value, cancellationToken);
            if (parent is null)
            {
                throw new ValidationException("La seccion principal seleccionada no existe.");
            }

            if (parent.ParentId is not null)
            {
                throw new ValidationException("La categoria padre debe ser una opcion principal del menu.");
            }
        }

        category.Name = request.Name;
        category.Slug = request.Slug;
        category.Description = request.Description;
        category.ImageUrl = request.ImageUrl;
        category.SortOrder = request.SortOrder;
        category.ParentId = request.ParentId;
        category.IsActive = request.IsActive;
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public sealed class DeleteCategoryCommandHandler(ICategoryRepository categories, IUnitOfWork unitOfWork) : IRequestHandler<DeleteCategoryCommand, bool>
{
    public async Task<bool> Handle(DeleteCategoryCommand request, CancellationToken cancellationToken)
    {
        var category = await categories.GetByIdAsync(request.Id, cancellationToken);
        if (category is null) return false;

        var relatedCategories = await categories.ListAsync(cancellationToken);
        if (relatedCategories.Any(item => item.ParentId == category.Id))
        {
            throw new ValidationException("No se puede eliminar la opcion de menu porque tiene categorias hijas asociadas.");
        }

        categories.Remove(category);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public sealed class SetCategoryStatusCommandHandler(ICategoryRepository categories, IUnitOfWork unitOfWork) : IRequestHandler<SetCategoryStatusCommand, bool>
{
    public async Task<bool> Handle(SetCategoryStatusCommand request, CancellationToken cancellationToken)
    {
        var category = await categories.GetByIdAsync(request.Id, cancellationToken);
        if (category is null) return false;
        category.IsActive = request.IsActive;
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }
}