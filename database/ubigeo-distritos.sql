-- ============================================================
-- Ubigeo Peru 2026 - Distritos
-- Fuente: https://github.com/leandrofrancisco03/Ubigeo-Peru-2026
-- Ejecutar DESPUES de init.sql (requiere Provinces ya sembradas)
-- ============================================================

use [ecommerce];
go

-- Helper: insert districts for one province at a time to keep batches small
-- Format: (CodigoDistrito 6-char, Nombre, CodigoProvincia 4-char)

-- ─── AMAZONAS (01) ───────────────────────────────────────────────────────────
if not exists (select 1 from [dbo].[Districts] where [CodigoSunat] = N'010101')
begin
    insert into [dbo].[Districts] ([Id],[ProvinceId],[CodigoSunat],[Name])
    select newid(), p.[Id], d.[c], d.[n]
    from (values
        (N'010101',N'Chachapoyas',N'0101'),(N'010102',N'Asuncion',N'0101'),(N'010103',N'Balsas',N'0101'),
        (N'010104',N'Cheto',N'0101'),(N'010105',N'Chiliquin',N'0101'),(N'010106',N'Chuquibamba',N'0101'),
        (N'010107',N'Granada',N'0101'),(N'010108',N'Huancas',N'0101'),(N'010109',N'La Jalca',N'0101'),
        (N'010110',N'Leimebamba',N'0101'),(N'010111',N'Levanto',N'0101'),(N'010112',N'Magdalena',N'0101'),
        (N'010113',N'Mariscal Castilla',N'0101'),(N'010114',N'Molinopampa',N'0101'),(N'010115',N'Montevideo',N'0101'),
        (N'010116',N'Olleros',N'0101'),(N'010117',N'Quinjalca',N'0101'),(N'010118',N'San Francisco De Daguas',N'0101'),
        (N'010119',N'San Isidro De Maino',N'0101'),(N'010120',N'Soloco',N'0101'),(N'010121',N'Sonche',N'0101'),
        (N'010201',N'Bagua',N'0102'),(N'010202',N'Aramango',N'0102'),(N'010203',N'Copallin',N'0102'),
        (N'010204',N'El Parco',N'0102'),(N'010205',N'Imaza',N'0102'),(N'010206',N'La Peca',N'0102'),
        (N'010701',N'Bagua Grande',N'0107'),(N'010702',N'Cajaruro',N'0107'),(N'010703',N'Cumba',N'0107'),
        (N'010704',N'El Milagro',N'0107'),(N'010705',N'Jamalca',N'0107'),(N'010706',N'Lonya Grande',N'0107'),
        (N'010707',N'Yamon',N'0107')
    ) as d([c],[n],[prov])
    join [dbo].[Provinces] p on p.[CodigoSunat] = d.[prov];
end
go

-- ─── CALLAO (07) ─────────────────────────────────────────────────────────────
if not exists (select 1 from [dbo].[Districts] where [CodigoSunat] = N'070101')
begin
    insert into [dbo].[Districts] ([Id],[ProvinceId],[CodigoSunat],[Name])
    select newid(), p.[Id], d.[c], d.[n]
    from (values
        (N'070101',N'Callao',N'0701'),(N'070102',N'Bellavista',N'0701'),
        (N'070103',N'Carmen De La Legua Reynoso',N'0701'),(N'070104',N'La Perla',N'0701'),
        (N'070105',N'La Punta',N'0701'),(N'070106',N'Ventanilla',N'0701'),
        (N'070107',N'Mi Peru',N'0701')
    ) as d([c],[n],[prov])
    join [dbo].[Provinces] p on p.[CodigoSunat] = d.[prov];
end
go

-- ─── AREQUIPA (04) ───────────────────────────────────────────────────────────
if not exists (select 1 from [dbo].[Districts] where [CodigoSunat] = N'040101')
begin
    insert into [dbo].[Districts] ([Id],[ProvinceId],[CodigoSunat],[Name])
    select newid(), p.[Id], d.[c], d.[n]
    from (values
        (N'040101',N'Arequipa',N'0401'),(N'040102',N'Alto Selva Alegre',N'0401'),(N'040103',N'Cayma',N'0401'),
        (N'040104',N'Cerro Colorado',N'0401'),(N'040105',N'Characato',N'0401'),(N'040106',N'Chiguata',N'0401'),
        (N'040107',N'Jacobo Hunter',N'0401'),(N'040108',N'La Joya',N'0401'),(N'040109',N'Mariano Melgar',N'0401'),
        (N'040110',N'Miraflores',N'0401'),(N'040111',N'Mollebaya',N'0401'),(N'040112',N'Paucarpata',N'0401'),
        (N'040113',N'Pocsi',N'0401'),(N'040114',N'Polobaya',N'0401'),(N'040115',N'Quequeña',N'0401'),
        (N'040116',N'Sabandia',N'0401'),(N'040117',N'Sachaca',N'0401'),(N'040118',N'San Juan De Siguas',N'0401'),
        (N'040119',N'San Juan De Tarucani',N'0401'),(N'040120',N'Santa Isabel De Siguas',N'0401'),
        (N'040121',N'Santa Rita De Siguas',N'0401'),(N'040122',N'Socabaya',N'0401'),
        (N'040123',N'Tiabaya',N'0401'),(N'040124',N'Uchumayo',N'0401'),(N'040125',N'Vitor',N'0401'),
        (N'040126',N'Yanahuara',N'0401'),(N'040127',N'Yarabamba',N'0401'),(N'040128',N'Yura',N'0401'),
        (N'040129',N'Jose Luis Bustamante Y Rivero',N'0401')
    ) as d([c],[n],[prov])
    join [dbo].[Provinces] p on p.[CodigoSunat] = d.[prov];
end
go

-- ─── CUSCO (08) ──────────────────────────────────────────────────────────────
if not exists (select 1 from [dbo].[Districts] where [CodigoSunat] = N'080101')
begin
    insert into [dbo].[Districts] ([Id],[ProvinceId],[CodigoSunat],[Name])
    select newid(), p.[Id], d.[c], d.[n]
    from (values
        (N'080101',N'Cusco',N'0801'),(N'080102',N'Ccorca',N'0801'),(N'080103',N'Poroy',N'0801'),
        (N'080104',N'San Jeronimo',N'0801'),(N'080105',N'San Sebastian',N'0801'),
        (N'080106',N'Santiago',N'0801'),(N'080107',N'Saylla',N'0801'),(N'080108',N'Wanchaq',N'0801')
    ) as d([c],[n],[prov])
    join [dbo].[Provinces] p on p.[CodigoSunat] = d.[prov];
end
go

-- ─── LA LIBERTAD - Trujillo (1301) ───────────────────────────────────────────
if not exists (select 1 from [dbo].[Districts] where [CodigoSunat] = N'130101')
begin
    insert into [dbo].[Districts] ([Id],[ProvinceId],[CodigoSunat],[Name])
    select newid(), p.[Id], d.[c], d.[n]
    from (values
        (N'130101',N'Trujillo',N'1301'),(N'130102',N'El Porvenir',N'1301'),
        (N'130103',N'Florencia De Mora',N'1301'),(N'130104',N'Huanchaco',N'1301'),
        (N'130105',N'La Esperanza',N'1301'),(N'130106',N'Laredo',N'1301'),
        (N'130107',N'Moche',N'1301'),(N'130108',N'Poroto',N'1301'),(N'130109',N'Salaverry',N'1301'),
        (N'130110',N'Simbal',N'1301'),(N'130111',N'Victor Larco Herrera',N'1301')
    ) as d([c],[n],[prov])
    join [dbo].[Provinces] p on p.[CodigoSunat] = d.[prov];
end
go

-- ─── LAMBAYEQUE - Chiclayo (1401) ────────────────────────────────────────────
if not exists (select 1 from [dbo].[Districts] where [CodigoSunat] = N'140101')
begin
    insert into [dbo].[Districts] ([Id],[ProvinceId],[CodigoSunat],[Name])
    select newid(), p.[Id], d.[c], d.[n]
    from (values
        (N'140101',N'Chiclayo',N'1401'),(N'140102',N'Chongoyape',N'1401'),(N'140103',N'Eten',N'1401'),
        (N'140104',N'Eten Puerto',N'1401'),(N'140105',N'Jose Leonardo Ortiz',N'1401'),
        (N'140106',N'La Victoria',N'1401'),(N'140107',N'Lagunas',N'1401'),(N'140108',N'Monsefu',N'1401'),
        (N'140109',N'Nueva Arica',N'1401'),(N'140110',N'Oyotun',N'1401'),(N'140111',N'Picsi',N'1401'),
        (N'140112',N'Pimentel',N'1401'),(N'140113',N'Reque',N'1401'),(N'140114',N'Santa Rosa',N'1401'),
        (N'140115',N'Saña',N'1401'),(N'140116',N'Cayalti',N'1401'),(N'140117',N'Patapo',N'1401'),
        (N'140118',N'Pomalca',N'1401'),(N'140119',N'Pucala',N'1401'),(N'140120',N'Tuman',N'1401')
    ) as d([c],[n],[prov])
    join [dbo].[Provinces] p on p.[CodigoSunat] = d.[prov];
end
go

-- ─── LIMA - Provincia Lima (1501) ────────────────────────────────────────────
if not exists (select 1 from [dbo].[Districts] where [CodigoSunat] = N'150101')
begin
    insert into [dbo].[Districts] ([Id],[ProvinceId],[CodigoSunat],[Name])
    select newid(), p.[Id], d.[c], d.[n]
    from (values
        (N'150101',N'Lima',N'1501'),(N'150102',N'Ancon',N'1501'),(N'150103',N'Ate',N'1501'),
        (N'150104',N'Barranco',N'1501'),(N'150105',N'Breña',N'1501'),(N'150106',N'Carabayllo',N'1501'),
        (N'150107',N'Chaclacayo',N'1501'),(N'150108',N'Chorrillos',N'1501'),(N'150109',N'Cieneguilla',N'1501'),
        (N'150110',N'Comas',N'1501'),(N'150111',N'El Agustino',N'1501'),(N'150112',N'Independencia',N'1501'),
        (N'150113',N'Jesus Maria',N'1501'),(N'150114',N'La Molina',N'1501'),(N'150115',N'La Victoria',N'1501'),
        (N'150116',N'Lince',N'1501'),(N'150117',N'Los Olivos',N'1501'),(N'150118',N'Lurigancho',N'1501'),
        (N'150119',N'Lurin',N'1501'),(N'150120',N'Magdalena Del Mar',N'1501'),(N'150121',N'Pueblo Libre',N'1501'),
        (N'150122',N'Miraflores',N'1501'),(N'150123',N'Pachacamac',N'1501'),(N'150124',N'Pucusana',N'1501'),
        (N'150125',N'Puente Piedra',N'1501'),(N'150126',N'Punta Hermosa',N'1501'),(N'150127',N'Punta Negra',N'1501'),
        (N'150128',N'Rimac',N'1501'),(N'150129',N'San Bartolo',N'1501'),(N'150130',N'San Borja',N'1501'),
        (N'150131',N'San Isidro',N'1501'),(N'150132',N'San Juan De Lurigancho',N'1501'),
        (N'150133',N'San Juan De Miraflores',N'1501'),(N'150134',N'San Luis',N'1501'),
        (N'150135',N'San Martin De Porres',N'1501'),(N'150136',N'San Miguel',N'1501'),
        (N'150137',N'Santa Anita',N'1501'),(N'150138',N'Santa Maria Del Mar',N'1501'),
        (N'150139',N'Santa Rosa',N'1501'),(N'150140',N'Santiago De Surco',N'1501'),
        (N'150141',N'Surquillo',N'1501'),(N'150142',N'Villa El Salvador',N'1501'),
        (N'150143',N'Villa Maria Del Triunfo',N'1501')
    ) as d([c],[n],[prov])
    join [dbo].[Provinces] p on p.[CodigoSunat] = d.[prov];
end
go

-- ─── PIURA - Piura (2001) ────────────────────────────────────────────────────
if not exists (select 1 from [dbo].[Districts] where [CodigoSunat] = N'200101')
begin
    insert into [dbo].[Districts] ([Id],[ProvinceId],[CodigoSunat],[Name])
    select newid(), p.[Id], d.[c], d.[n]
    from (values
        (N'200101',N'Piura',N'2001'),(N'200104',N'Castilla',N'2001'),(N'200105',N'Catacaos',N'2001'),
        (N'200107',N'Cura Mori',N'2001'),(N'200108',N'El Tallan',N'2001'),(N'200109',N'La Arena',N'2001'),
        (N'200110',N'La Union',N'2001'),(N'200111',N'Las Lomas',N'2001'),
        (N'200114',N'Tambo Grande',N'2001'),(N'200115',N'Veintiseis De Octubre',N'2001')
    ) as d([c],[n],[prov])
    join [dbo].[Provinces] p on p.[CodigoSunat] = d.[prov];
end
go

-- ─── SAN MARTIN - San Martin (2209) ──────────────────────────────────────────
if not exists (select 1 from [dbo].[Districts] where [CodigoSunat] = N'220901')
begin
    insert into [dbo].[Districts] ([Id],[ProvinceId],[CodigoSunat],[Name])
    select newid(), p.[Id], d.[c], d.[n]
    from (values
        (N'220901',N'Tarapoto',N'2209'),(N'220902',N'Alberto Leveau',N'2209'),(N'220903',N'Cacatachi',N'2209'),
        (N'220904',N'Chazuta',N'2209'),(N'220905',N'Chipurana',N'2209'),(N'220906',N'El Porvenir',N'2209'),
        (N'220907',N'Huimbayoc',N'2209'),(N'220908',N'Juan Guerra',N'2209'),
        (N'220909',N'La Banda De Shilcayo',N'2209'),(N'220910',N'Morales',N'2209'),
        (N'220911',N'Papaplaya',N'2209'),(N'220912',N'San Antonio',N'2209'),
        (N'220913',N'Sauce',N'2209'),(N'220914',N'Shapaja',N'2209')
    ) as d([c],[n],[prov])
    join [dbo].[Provinces] p on p.[CodigoSunat] = d.[prov];
end
go

-- ─── TACNA - Tacna (2301) ────────────────────────────────────────────────────
if not exists (select 1 from [dbo].[Districts] where [CodigoSunat] = N'230101')
begin
    insert into [dbo].[Districts] ([Id],[ProvinceId],[CodigoSunat],[Name])
    select newid(), p.[Id], d.[c], d.[n]
    from (values
        (N'230101',N'Tacna',N'2301'),(N'230102',N'Alto De La Alianza',N'2301'),
        (N'230103',N'Calana',N'2301'),(N'230104',N'Ciudad Nueva',N'2301'),
        (N'230105',N'Inclan',N'2301'),(N'230106',N'Pachia',N'2301'),
        (N'230107',N'Palca',N'2301'),(N'230108',N'Pocollay',N'2301'),
        (N'230109',N'Sama',N'2301'),(N'230110',N'Coronel Gregorio Albarracin Lanchipa',N'2301'),
        (N'230111',N'La Yarada Los Palos',N'2301')
    ) as d([c],[n],[prov])
    join [dbo].[Provinces] p on p.[CodigoSunat] = d.[prov];
end
go

-- ─── ICA - Ica (1101) ────────────────────────────────────────────────────────
if not exists (select 1 from [dbo].[Districts] where [CodigoSunat] = N'110101')
begin
    insert into [dbo].[Districts] ([Id],[ProvinceId],[CodigoSunat],[Name])
    select newid(), p.[Id], d.[c], d.[n]
    from (values
        (N'110101',N'Ica',N'1101'),(N'110102',N'La Tinguiña',N'1101'),(N'110103',N'Los Aquijes',N'1101'),
        (N'110104',N'Ocucaje',N'1101'),(N'110105',N'Pachacutec',N'1101'),(N'110106',N'Parcona',N'1101'),
        (N'110107',N'Pueblo Nuevo',N'1101'),(N'110108',N'Salas',N'1101'),
        (N'110109',N'San Jose De Los Molinos',N'1101'),(N'110110',N'San Juan Bautista',N'1101'),
        (N'110111',N'Santiago',N'1101'),(N'110112',N'Subtanjalla',N'1101'),
        (N'110113',N'Tate',N'1101'),(N'110114',N'Yauca Del Rosario',N'1101'),
        (N'110501',N'Pisco',N'1105'),(N'110502',N'Huancano',N'1105'),(N'110503',N'Humay',N'1105'),
        (N'110504',N'Independencia',N'1105'),(N'110505',N'Paracas',N'1105'),
        (N'110506',N'San Andres',N'1105'),(N'110507',N'San Clemente',N'1105'),
        (N'110508',N'Tupac Amaru Inca',N'1105')
    ) as d([c],[n],[prov])
    join [dbo].[Provinces] p on p.[CodigoSunat] = d.[prov];
end
go

-- ─── JUNIN - Huancayo (1201) ─────────────────────────────────────────────────
if not exists (select 1 from [dbo].[Districts] where [CodigoSunat] = N'120101')
begin
    insert into [dbo].[Districts] ([Id],[ProvinceId],[CodigoSunat],[Name])
    select newid(), p.[Id], d.[c], d.[n]
    from (values
        (N'120101',N'Huancayo',N'1201'),(N'120107',N'Chilca',N'1201'),(N'120114',N'El Tambo',N'1201'),
        (N'120117',N'Hualhuas',N'1201'),(N'120119',N'Huancan',N'1201'),(N'120125',N'Pilcomayo',N'1201'),
        (N'120129',N'San Agustin',N'1201'),(N'120133',N'Sapallanga',N'1201'),(N'120134',N'Sicaya',N'1201')
    ) as d([c],[n],[prov])
    join [dbo].[Provinces] p on p.[CodigoSunat] = d.[prov];
end
go

-- ─── PUNO - Puno (2101) ──────────────────────────────────────────────────────
if not exists (select 1 from [dbo].[Districts] where [CodigoSunat] = N'210101')
begin
    insert into [dbo].[Districts] ([Id],[ProvinceId],[CodigoSunat],[Name])
    select newid(), p.[Id], d.[c], d.[n]
    from (values
        (N'210101',N'Puno',N'2101'),(N'210102',N'Acora',N'2101'),(N'210103',N'Amantani',N'2101'),
        (N'210104',N'Atuncolla',N'2101'),(N'210105',N'Capachica',N'2101'),(N'210106',N'Chucuito',N'2101'),
        (N'210107',N'Coata',N'2101'),(N'210108',N'Huata',N'2101'),(N'210109',N'Mañazo',N'2101'),
        (N'210110',N'Paucarcolla',N'2101'),(N'210111',N'Pichacani',N'2101'),(N'210112',N'Plateria',N'2101'),
        (N'210113',N'San Antonio',N'2101'),(N'210114',N'Tiquillaca',N'2101'),(N'210115',N'Vilque',N'2101'),
        (N'211101',N'Juliaca',N'2111'),(N'211102',N'Cabana',N'2111'),(N'211103',N'Cabanillas',N'2111'),
        (N'211104',N'Caracoto',N'2111'),(N'211105',N'San Miguel',N'2111')
    ) as d([c],[n],[prov])
    join [dbo].[Provinces] p on p.[CodigoSunat] = d.[prov];
end
go

-- ─── CAJAMARCA - Cajamarca (0601) ────────────────────────────────────────────
if not exists (select 1 from [dbo].[Districts] where [CodigoSunat] = N'060101')
begin
    insert into [dbo].[Districts] ([Id],[ProvinceId],[CodigoSunat],[Name])
    select newid(), p.[Id], d.[c], d.[n]
    from (values
        (N'060101',N'Cajamarca',N'0601'),(N'060102',N'Asuncion',N'0601'),(N'060103',N'Chetilla',N'0601'),
        (N'060104',N'Cospan',N'0601'),(N'060105',N'Encañada',N'0601'),(N'060106',N'Jesus',N'0601'),
        (N'060107',N'Llacanora',N'0601'),(N'060108',N'Los Baños Del Inca',N'0601'),
        (N'060109',N'Magdalena',N'0601'),(N'060110',N'Matara',N'0601'),
        (N'060111',N'Namora',N'0601'),(N'060112',N'San Juan',N'0601')
    ) as d([c],[n],[prov])
    join [dbo].[Provinces] p on p.[CodigoSunat] = d.[prov];
end
go

-- ─── AYACUCHO - Huamanga (0501) ──────────────────────────────────────────────
if not exists (select 1 from [dbo].[Districts] where [CodigoSunat] = N'050101')
begin
    insert into [dbo].[Districts] ([Id],[ProvinceId],[CodigoSunat],[Name])
    select newid(), p.[Id], d.[c], d.[n]
    from (values
        (N'050101',N'Ayacucho',N'0501'),(N'050102',N'Acocro',N'0501'),(N'050103',N'Acos Vinchos',N'0501'),
        (N'050104',N'Carmen Alto',N'0501'),(N'050105',N'Chiara',N'0501'),(N'050106',N'Ocros',N'0501'),
        (N'050107',N'Pacaycasa',N'0501'),(N'050108',N'Quinua',N'0501'),
        (N'050109',N'San Jose De Ticllas',N'0501'),(N'050110',N'San Juan Bautista',N'0501'),
        (N'050111',N'Santiago De Pischa',N'0501'),(N'050112',N'Socos',N'0501'),
        (N'050113',N'Tambillo',N'0501'),(N'050114',N'Vinchos',N'0501'),
        (N'050115',N'Jesus Nazareno',N'0501')
    ) as d([c],[n],[prov])
    join [dbo].[Provinces] p on p.[CodigoSunat] = d.[prov];
end
go

-- ─── LORETO - Maynas / Iquitos (1601) ────────────────────────────────────────
if not exists (select 1 from [dbo].[Districts] where [CodigoSunat] = N'160101')
begin
    insert into [dbo].[Districts] ([Id],[ProvinceId],[CodigoSunat],[Name])
    select newid(), p.[Id], d.[c], d.[n]
    from (values
        (N'160101',N'Iquitos',N'1601'),(N'160102',N'Alto Nanay',N'1601'),(N'160103',N'Fernando Lores',N'1601'),
        (N'160104',N'Indiana',N'1601'),(N'160105',N'Las Amazonas',N'1601'),(N'160106',N'Mazan',N'1601'),
        (N'160107',N'Napo',N'1601'),(N'160108',N'Punchana',N'1601'),(N'160110',N'Torres Causana',N'1601'),
        (N'160112',N'Belen',N'1601'),(N'160113',N'San Juan Bautista',N'1601')
    ) as d([c],[n],[prov])
    join [dbo].[Provinces] p on p.[CodigoSunat] = d.[prov];
end
go

-- ─── TUMBES (24) ─────────────────────────────────────────────────────────────
if not exists (select 1 from [dbo].[Districts] where [CodigoSunat] = N'240101')
begin
    insert into [dbo].[Districts] ([Id],[ProvinceId],[CodigoSunat],[Name])
    select newid(), p.[Id], d.[c], d.[n]
    from (values
        (N'240101',N'Tumbes',N'2401'),(N'240102',N'Corrales',N'2401'),(N'240103',N'La Cruz',N'2401'),
        (N'240104',N'Pampas De Hospital',N'2401'),(N'240105',N'San Jacinto',N'2401'),
        (N'240106',N'San Juan De La Virgen',N'2401'),
        (N'240201',N'Zorritos',N'2402'),(N'240202',N'Casitas',N'2402'),(N'240203',N'Canoas De Punta Sal',N'2402'),
        (N'240301',N'Zarumilla',N'2403'),(N'240302',N'Aguas Verdes',N'2403'),
        (N'240303',N'Matapalo',N'2403'),(N'240304',N'Papayal',N'2403')
    ) as d([c],[n],[prov])
    join [dbo].[Provinces] p on p.[CodigoSunat] = d.[prov];
end
go

-- ─── MOQUEGUA (18) ───────────────────────────────────────────────────────────
if not exists (select 1 from [dbo].[Districts] where [CodigoSunat] = N'180101')
begin
    insert into [dbo].[Districts] ([Id],[ProvinceId],[CodigoSunat],[Name])
    select newid(), p.[Id], d.[c], d.[n]
    from (values
        (N'180101',N'Moquegua',N'1801'),(N'180102',N'Carumas',N'1801'),(N'180103',N'Cuchumbaya',N'1801'),
        (N'180104',N'Samegua',N'1801'),(N'180105',N'San Cristobal',N'1801'),(N'180106',N'Torata',N'1801'),
        (N'180301',N'Ilo',N'1803'),(N'180302',N'El Algarrobal',N'1803'),(N'180303',N'Pacocha',N'1803')
    ) as d([c],[n],[prov])
    join [dbo].[Provinces] p on p.[CodigoSunat] = d.[prov];
end
go

-- ─── UCAYALI - Coronel Portillo / Pucallpa (2501) ────────────────────────────
if not exists (select 1 from [dbo].[Districts] where [CodigoSunat] = N'250101')
begin
    insert into [dbo].[Districts] ([Id],[ProvinceId],[CodigoSunat],[Name])
    select newid(), p.[Id], d.[c], d.[n]
    from (values
        (N'250101',N'Calleria',N'2501'),(N'250102',N'Campoverde',N'2501'),(N'250103',N'Iparia',N'2501'),
        (N'250104',N'Masisea',N'2501'),(N'250105',N'Yarinacocha',N'2501'),
        (N'250106',N'Nueva Requena',N'2501'),(N'250107',N'Manantay',N'2501')
    ) as d([c],[n],[prov])
    join [dbo].[Provinces] p on p.[CodigoSunat] = d.[prov];
end
go

-- ─── MADRE DE DIOS (17) ──────────────────────────────────────────────────────
if not exists (select 1 from [dbo].[Districts] where [CodigoSunat] = N'170101')
begin
    insert into [dbo].[Districts] ([Id],[ProvinceId],[CodigoSunat],[Name])
    select newid(), p.[Id], d.[c], d.[n]
    from (values
        (N'170101',N'Tambopata',N'1701'),(N'170102',N'Inambari',N'1701'),
        (N'170103',N'Las Piedras',N'1701'),(N'170104',N'Laberinto',N'1701'),
        (N'170201',N'Manu',N'1702'),(N'170202',N'Fitzcarrald',N'1702'),
        (N'170203',N'Madre De Dios',N'1702'),(N'170204',N'Huepetuhe',N'1702')
    ) as d([c],[n],[prov])
    join [dbo].[Provinces] p on p.[CodigoSunat] = d.[prov];
end
go

print 'Ubigeo distritos sembrados correctamente.';
go
