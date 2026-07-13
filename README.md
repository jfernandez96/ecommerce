# Ecommerce Enterprise Monorepo

Plataforma ecommerce profesional para moda, zapatillas, accesorios, bolsos, gorros, perfumes, relojes y productos genéricos. El diseño está inspirado en buenas prácticas de experiencia de compra moderna, sin copiar diseños externos.

## Stack

- Frontend: Next.js 15, React 19, TypeScript, TailwindCSS, componentes estilo shadcn UI, Framer Motion, React Query, Zustand, Axios.
- Backend: ASP.NET Core 9, Clean Architecture, CQRS, MediatR, Repository Pattern, Unit of Work, FluentValidation, EF Core, Dapper, Swagger, JWT, roles.
- Datos e infraestructura: SQL Server, Redis, Docker Compose, SQL optimizado, Cloudinary preparado por configuración.
- Calidad: xUnit, FluentAssertions, GitHub Actions.

## Estructura

- `src/frontend`: storefront, carrito, checkout, admin UI, SEO técnico y estado global.
- `src/backend/Ecommerce.Domain`: entidades y reglas del dominio.
- `src/backend/Ecommerce.Application`: DTOs, CQRS, validators, contratos.
- `src/backend/Ecommerce.Infrastructure`: EF Core, Dapper, repositorios, Unit of Work, JWT, hashing.
- `src/backend/Ecommerce.Api`: controllers REST versionados, Swagger, JWT, CORS, rate limit, errores globales.
- `database/init.sql`: esquema inicial con relaciones, índices, constraints y datos base.

## Ejecutar con Docker

```powershell
docker compose up --build
```

API: `http://localhost:5184/swagger`

## Ejecutar local

Backend:

```powershell
dotnet restore Ecommerce.slnx
dotnet run --project src/backend/Ecommerce.Api/Ecommerce.Api.csproj
```

Frontend, cuando Node/npm estén disponibles en PATH:

```powershell
cd src/frontend
npm install
npm run dev
```

Storefront: `http://localhost:3000`

El frontend lee el API desde `src/frontend/.env.local` o `NEXT_PUBLIC_API_URL`. Para desarrollo local debe apuntar a:

```text
NEXT_PUBLIC_API_URL=http://localhost:5036/api/v1
```

## Acceso administrador local

Ruta: `http://localhost:3000/admin/login`

Usuario seed de desarrollo:

```text
Email: admin@novamarket.local
Password: Admin123*
```

Ejecuta `database/init.sql` en SQL Server si tu base local aun no tiene el usuario seed.

## Variables de producción

- `ConnectionStrings__SqlServer`
- `ConnectionStrings__Redis`
- `Jwt__Secret`
- `Jwt__Issuer`
- `Jwt__Audience`
- `Cloudinary__CloudName`
- `Cloudinary__ApiKey`
- `Cloudinary__ApiSecret`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SITE_URL`

## Deployment

- Guía de despliegue a producción en Ubuntu con dominio, Nginx y SSL Let's Encrypt: [docs/deploy-prod-ubuntu.txt](docs/deploy-prod-ubuntu.txt)

## Módulos cubiertos

- Home premium, banner, categorías, marcas, destacados, beneficios, opiniones/Instagram preparado, newsletter/footer base.
- Catálogo con búsqueda, filtros preparados y paginación desde API.
- Producto con galería, stock, especificaciones, social sharing, favoritos/WhatsApp preparados.
- Carrito con cantidades, subtotal, IGV y total.
- Checkout invitado/registrado preparado para Stripe, Mercado Pago, Yape, Plin y transferencia.
- Admin protegido por rol a nivel frontend y backend, con módulos base para ventas, pedidos, clientes, productos y promociones.
- Base de datos inicial con productos, variantes, imágenes, marcas, categorías, usuarios, carrito y pedidos modelados en dominio/API.

## Próximos módulos recomendados

1. Migraciones EF Core versionadas y seed de administrador.
2. Integración real de Stripe, Mercado Pago, Yape/Plin y Cloudinary.
3. CRUD completo admin por módulo con importación/exportación Excel.
4. Notificaciones por correo, WhatsApp y push.
5. Observabilidad con OpenTelemetry, métricas y dashboard de reportes.