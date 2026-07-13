using Ecommerce.Domain.Catalog;
using FluentAssertions;

namespace Ecommerce.UnitTests;

public class ProductTests
{
    [Fact]
    public void EffectivePrice_UsesSalePrice_WhenSalePriceIsLower()
    {
        var product = new Product
        {
            Name = "Test product",
            Slug = "test-product",
            Sku = "SKU-1",
            Code = "CODE-1",
            BrandId = Guid.NewGuid(),
            CategoryId = Guid.NewGuid(),
            RegularPrice = 100,
            SalePrice = 80,
            Stock = 3
        };

        product.EffectivePrice.Should().Be(80);
        product.IsOnSale.Should().BeTrue();
    }
}
