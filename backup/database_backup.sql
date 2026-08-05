-- ============================================================
-- BACKUP COMPLETO DO BANCO DE DADOS - OrcaPro PWA
-- Data: 2026-07-28
-- Total: 7 tabelas, 38 registros
-- ============================================================
-- Este arquivo restaura TODOS os dados do banco.
-- Para usar em uma nova plataforma Supabase:
--   1. Rode todas as migrations da pasta supabase/migrations/
--   2. Rode este arquivo para inserir os dados
-- ============================================================

-- ===== COMPANIES (3 empresas) =====
INSERT INTO public.companies (id, name, active, primary_color, logo_url, created_at) VALUES
  ('4a65c254-8daf-4ca9-b430-eab74b1351b2', 'SJC Engenharia E Soluções', true, '#244cd1', 'https://lshvjjmfosmwuoaqfzgh.supabase.co/storage/v1/object/public/logos/4a65c254-8daf-4ca9-b430-eab74b1351b2/logo-1784976705236.png', '2026-07-25T10:37:44.594714+00:00'),
  ('4883c2c8-9941-4214-9c2c-ba43c7fb308b', 'Alfa Elétrica', true, '#2563eb', NULL, '2026-07-27T02:33:45.035046+00:00'),
  ('a26b3016-7875-4e1d-9604-5a3dcfb7637a', 'CAST SERVIÇOS TÉCNICOS', true, '#8aebe7', 'https://lshvjjmfosmwuoaqfzgh.supabase.co/storage/v1/object/public/logos/a26b3016-7875-4e1d-9604-5a3dcfb7637a/logo-1785174146415.jpg', '2026-07-27T16:51:11.851684+00:00');

-- ===== PROFILES (7 usuarios) =====
-- NOTA: Os IDs dos profiles referencia auth.users. Ao restaurar em um novo
-- Supabase, os usuarios precisam ser recriados via auth (signup) e os IDs
-- podem mudar. Os dados abaixo sao para referencia/registro.
INSERT INTO public.profiles (id, email, role, company_id, name, created_at) VALUES
  ('8a8a19df-8a6b-4444-bd1c-3b9d644e1428', 'dev@orcapro.app', 'dev', NULL, NULL, '2026-07-25T10:32:14.15237+00:00'),
  ('ea2876fb-6ca9-4c91-a96f-c4ca97e0556d', 'sjc@cast.con', 'empresa', '4a65c254-8daf-4ca9-b430-eab74b1351b2', NULL, '2026-07-25T10:37:44.974604+00:00'),
  ('cfa6ff5d-9c85-4f5c-80fe-a3e04fa643a6', 'cas@pwa.com', 'tecnico', '4a65c254-8daf-4ca9-b430-eab74b1351b2', 'Carlos', '2026-07-27T01:57:48.879913+00:00'),
  ('f538b2f4-9310-463f-b78a-71002854197a', 'alfa@dev.com', 'empresa', '4883c2c8-9941-4214-9c2c-ba43c7fb308b', NULL, '2026-07-27T02:33:45.6779+00:00'),
  ('95d9cd5d-96c2-43d3-b2ed-d3b839a38f1d', 'edson@alfa.com', 'tecnico', '4883c2c8-9941-4214-9c2c-ba43c7fb308b', 'EDSON LUIS', '2026-07-27T02:35:12.857366+00:00'),
  ('60f226bb-3650-457c-a3bc-c1175dc9ddbc', 'lp@alfa.com', 'tecnico', '4883c2c8-9941-4214-9c2c-ba43c7fb308b', 'LUIS PAULO', '2026-07-27T02:36:03.928467+00:00'),
  ('e1edf86a-f38e-4e4a-8a55-fbeefc6718f2', 'cast.servicostecnicos@gmail.com', 'empresa', 'a26b3016-7875-4e1d-9604-5a3dcfb7637a', NULL, '2026-07-27T16:51:12.814535+00:00');

-- ===== BUDGETS (3 orcamentos) =====
INSERT INTO public.budgets (id, title, status, user_id, company_id, client_name, client_email, client_phone, description, valid_until, labor_cost, created_at, updated_at) VALUES
  ('e53c2fa3-6766-4e65-8d25-c9fbface949e', 'Instalação de quadro', 'draft', 'ea2876fb-6ca9-4c91-a96f-c4ca97e0556d', '4a65c254-8daf-4ca9-b430-eab74b1351b2', 'Campo Del Rey', 'delrey@gmail.com', '129987654321', 'Serviço de instalação de quadro de comando de bombas de recalque.', '2026-07-31', 0, '2026-07-25T10:50:49.499341+00:00', '2026-07-26T01:44:57.473039+00:00'),
  ('e8bca948-771b-4028-b4d5-fdc4962f049d', 'iluminação de jardim', 'draft', 'f538b2f4-9310-463f-b78a-71002854197a', '4883c2c8-9941-4214-9c2c-ba43c7fb308b', 'alessandra', 'alessandra@cast.com', '12987456321', 'serviço de instalação de iluninação no jardim a frente a casa, com pontos de luz em branco quente 3000k', '2026-08-01', 0, '2026-07-27T02:50:40.189875+00:00', '2026-07-27T02:51:59.355848+00:00'),
  ('0ecad01d-3ed9-4473-83c2-88d8bae8304e', 'INSTALAÇÃO DE TOMADAS DE CARRO ELÉTRICO', 'draft', 'ea2876fb-6ca9-4c91-a96f-c4ca97e0556d', '4a65c254-8daf-4ca9-b430-eab74b1351b2', 'PAESAGGIO', 'ho@dev.com', '(12)98765-4321', 'INSTALAÇÃO DE INFRA E REDE PARA TOMADA DE CARRO ELÉTRICO E WALLBOX', '2026-07-31', 1200, '2026-07-27T04:28:34.362609+00:00', '2026-07-27T04:28:34.362609+00:00');

-- ===== BUDGET_ITEMS (13 itens) =====
INSERT INTO public.budget_items (id, budget_id, description, quantity, unit, unit_price, created_at) VALUES
  ('dd66e323-c457-41ae-9274-1d3466b22b70', 'e53c2fa3-6766-4e65-8d25-c9fbface949e', 'Quadro de comando', 1, 'un', 890, '2026-07-26T01:44:58.364745+00:00'),
  ('f88e10e7-5c4d-424c-a486-5189cb9c6c55', 'e53c2fa3-6766-4e65-8d25-c9fbface949e', 'Cabo PP 3x6mm', 60, 'm', 14.5, '2026-07-26T01:44:58.364745+00:00'),
  ('f55088d4-f248-417c-b973-07c9b39673bd', 'e53c2fa3-6766-4e65-8d25-c9fbface949e', 'Conduíte 3/4 rolo 50m', 1, 'un', 120, '2026-07-26T01:44:58.364745+00:00'),
  ('07c475d4-384d-407a-889c-5bceb8d99f8b', 'e53c2fa3-6766-4e65-8d25-c9fbface949e', 'Mão de obra', 1, 'un', 1800, '2026-07-26T01:44:58.364745+00:00'),
  ('215fe6b1-f708-4d01-97e7-a231da8328b8', 'e8bca948-771b-4028-b4d5-fdc4962f049d', 'SPOTS 3000K 7W', 12, 'un', 42, '2026-07-27T02:51:59.677904+00:00'),
  ('01f2ca04-6814-4dd6-9b48-d87eea630457', 'e8bca948-771b-4028-b4d5-fdc4962f049d', 'CABO PP 3X1,5MM', 40, 'm', 7.2, '2026-07-27T02:51:59.677904+00:00'),
  ('578980fa-893f-4c51-9ae3-25af369fa518', 'e8bca948-771b-4028-b4d5-fdc4962f049d', 'PACOTE EMENDA DERIVAÇÃO 2,5MM 50 UNIDADES', 1, 'un', 30, '2026-07-27T02:51:59.677904+00:00'),
  ('3305e455-9203-422a-af6c-787a534a820a', 'e8bca948-771b-4028-b4d5-fdc4962f049d', 'DISJUNTOR 10A', 1, 'un', 45, '2026-07-27T02:51:59.677904+00:00'),
  ('d648f464-b86f-4754-aa4f-ce02cd3b448f', 'e8bca948-771b-4028-b4d5-fdc4962f049d', 'CAIXA DISJUNTOR PROTEÇÃO IP66', 1, 'un', 92, '2026-07-27T02:51:59.677904+00:00'),
  ('3cea6cea-e4bd-4865-a238-5658e3029be0', 'e8bca948-771b-4028-b4d5-fdc4962f049d', 'MÃO DE OBRA', 1, 'un', 1100, '2026-07-27T02:51:59.677904+00:00'),
  ('a5db37ac-6414-4983-bc65-369c96d32af8', '0ecad01d-3ed9-4473-83c2-88d8bae8304e', 'CABO 6MM PRETO', 30, 'm', 9, '2026-07-27T04:28:35.355403+00:00'),
  ('3ecd5ba7-881a-41a3-a86b-5565f2b2523b', '0ecad01d-3ed9-4473-83c2-88d8bae8304e', 'CABO 6MM AZUL', 30, 'm', 9, '2026-07-27T04:28:35.355403+00:00'),
  ('68ab0e8f-dc16-4ee4-8d2f-fad328dbe3ca', '0ecad01d-3ed9-4473-83c2-88d8bae8304e', 'CABO 6MM VERDE', 30, 'm', 9, '2026-07-27T04:28:35.355403+00:00');

-- ===== SERVICE_ORDERS (2 ordens de servico) =====
INSERT INTO public.service_orders (id, company_id, budget_id, user_id, client_name, client_email, client_phone, title, service_to_execute, materials_used, technician, technician_id, status, notes, created_at, updated_at) VALUES
  ('128fac01-7db4-40ef-817f-9bb0aff40745', '4a65c254-8daf-4ca9-b430-eab74b1351b2', 'e53c2fa3-6766-4e65-8d25-c9fbface949e', 'ea2876fb-6ca9-4c91-a96f-c4ca97e0556d', 'Campo Del Rey', 'delrey@gmail.com', '129987654321', 'O.S. — Instalação de quadro', 'Serviço de instalação de quadro de comando de bombas de recalque.', ARRAY['Quadro de comando — 1 un','Cabo PP 3x6mm — 60 m','Conduíte 3/4 rolo 50m — 1 un'], 'cas@pwa.com', 'cfa6ff5d-9c85-4f5c-80fe-a3e04fa643a6', 'completed', 'REALIZADA INSTALAÇÃO DO QUADRO', '2026-07-27T04:21:58.464289+00:00', '2026-07-27T12:46:24.786314+00:00'),
  ('9cbac3b4-5f93-4153-b3a5-348a361f7343', '4a65c254-8daf-4ca9-b430-eab74b1351b2', '0ecad01d-3ed9-4473-83c2-88d8bae8304e', 'ea2876fb-6ca9-4c91-a96f-c4ca97e0556d', 'PAESAGGIO', 'ho@dev.com', '(12)98765-4321', 'O.S. — INSTALAÇÃO DE TOMADAS DE CARRO ELÉTRICO', 'INSTALAÇÃO DE INFRA E REDE PARA TOMADA DE CARRO ELÉTRICO E WALLBOX', ARRAY['CABO 6MM PRETO — 30 m','CABO 6MM AZUL — 30 m','CABO 6MM VERDE — 30 m'], 'Carlos', 'cfa6ff5d-9c85-4f5c-80fe-a3e04fa643a6', 'completed', 'REALIZADA A INSTALAÇÃO DO WALLBOX E DA TOMADA, SEGUINDO O PROJETO INICIAL, E DEIXANDO INFRA PRONTA PARA OS TOMADAS QUE SERÃO INSTALADA POSTERIORMENTE', '2026-07-27T04:28:58.196993+00:00', '2026-07-27T12:48:05.04509+00:00');

-- ===== SERVICE_ORDER_ITEMS (6 itens) =====
INSERT INTO public.service_order_items (id, service_order_id, description, quantity, unit, created_at) VALUES
  ('f966b324-0d23-454d-9462-87a6e4779860', '128fac01-7db4-40ef-817f-9bb0aff40745', 'DISJUNTOR 40A BIPOLAR', 1, 'un', '2026-07-27T12:38:43.747325+00:00'),
  ('72950477-67a3-4a63-9325-4068ca957ea2', '128fac01-7db4-40ef-817f-9bb0aff40745', 'BARRAMENTO BIPOLAR', 1, 'un', '2026-07-27T12:38:43.747325+00:00'),
  ('beeae47b-c118-4a71-2bb-832d99cbddae', '128fac01-7db4-40ef-817f-9bb0aff40745', 'DPS 25A', 3, 'un', '2026-07-27T12:46:25.104954+00:00'),
  ('83708705-9058-48a3-a90f-d88ce9827324', '9cbac3b4-5f93-4153-b3a5-348a361f7343', 'DISJUNTOR 40A UNIPOLAR', 2, 'un', '2026-07-27T12:10:44.43912+00:00'),
  ('e1bb5eab-8b2a-4e27-8d09-26ec18319277', '9cbac3b4-5f93-4153-b3a5-348a361f7343', 'MEDIDOR DE ENERGIA', 1, 'un', '2026-07-27T12:10:44.43912+00:00'),
  ('956bf915-e25d-4ce1-9986-430affef2cc3', '9cbac3b4-5f93-4153-b3a5-348a361f7343', 'TERMINAIS 6MM - PACOTE COM 20', 1, 'un', '2026-07-27T12:48:05.361279+00:00');

-- ===== SERVICE_ORDER_PHOTOS (4 fotos) =====
INSERT INTO public.service_order_photos (id, service_order_id, storage_path, kind, position, created_at) VALUES
  ('929be796-7bd4-4d75-af70-8e5ec98a5e2c', '9cbac3b4-5f93-4153-b3a5-348a361f7343', '9cbac3b4-5f93-4153-b3a5-348a361f7343/1785154159525-7trfqi.jpg', 'before', 0, '2026-07-27T12:09:21.680508+00:00'),
  ('765ec27f-a0da-40d1-8d0e-4239d75ff434', '9cbac3b4-5f93-4153-b3a5-348a361f7343', '9cbac3b4-5f93-4153-b3a5-348a361f7343/1785154171871-8hb8ui.jpg', 'after', 0, '2026-07-27T12:09:33.210652+00:00'),
  ('553a1cb9-7a68-4f24-a0f9-539c87962a63', '128fac01-7db4-40ef-817f-9bb0aff40745', '128fac01-7db4-40ef-817f-9bb0aff40745/1785155904135-ffkbr4.jpg', 'before', 0, '2026-07-27T12:38:26.242693+00:00'),
  ('21ddafa1-10d5-45a4-a686-8cb5ad26c7f6', '128fac01-7db4-40ef-817f-9bb0aff40745', '128fac01-7db4-40ef-817f-9bb0aff40745/1785155917848-vpadkd.jpg', 'after', 0, '2026-07-27T12:38:39.586291+00:00');
