FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY ["src/backend/Ecommerce.Api/Ecommerce.Api.csproj", "src/backend/Ecommerce.Api/"]
COPY ["src/backend/Ecommerce.Application/Ecommerce.Application.csproj", "src/backend/Ecommerce.Application/"]
COPY ["src/backend/Ecommerce.Domain/Ecommerce.Domain.csproj", "src/backend/Ecommerce.Domain/"]
COPY ["src/backend/Ecommerce.Infrastructure/Ecommerce.Infrastructure.csproj", "src/backend/Ecommerce.Infrastructure/"]
RUN dotnet restore "src/backend/Ecommerce.Api/Ecommerce.Api.csproj"
COPY . .
RUN dotnet publish "src/backend/Ecommerce.Api/Ecommerce.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Ecommerce.Api.dll"]