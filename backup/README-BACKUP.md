# Guia de Backup - OrcaPro PWA

Este guia explica passo a passo como fazer o backup completo do seu app
e como replicar em outra plataforma, caso necessario.

---

## O que esta neste backup

O backup tem 2 partes:

1. **Codigo-fonte do app** - todos os arquivos do projeto (pasta raiz do projeto)
2. **Banco de dados** - o arquivo `database_backup.sql` nesta pasta, com todos os dados:
   - 3 empresas (SJC Engenharia, Alfa Elétrica, CAST Serviços)
   - 7 usuarios (1 dev, 3 empresas, 3 tecnicos)
   - 3 orcamentos com 13 itens
   - 2 ordens de servico com 6 itens e 4 fotos

---

## PARTE 1 - Baixar o codigo-fonte (o app inteiro)

No Bolt, faca o seguinte:

1. Abra o projeto no Bolt (voce ja esta nele)
2. No **topo esquerdo** da tela, clique no **nome do projeto**
   - E o texto que fica no canto superior esquerdo, com o nome do projeto
3. Vai abrir um menu - clique em **Export**
4. Clique em **Download**
5. Vai baixar um arquivo .zip no seu computador com TODOS os arquivos
6. Guarde esse arquivo em um local seguro

Para rodar no seu computador depois:
- Descompacte o .zip
- Instale o Node.js (nodejs.org)
- Abra o terminal na pasta do projeto
- Rode: `npm install` e depois `npm run dev`

---

## PARTE 2 - Baixar o banco de dados

O arquivo `database_backup.sql` (nesta pasta) ja tem todos os dados.
Para baixa-lo:

1. No Bolt, no painel de arquivos (lado esquerdo), abra a pasta **backup**
2. Clique no arquivo **database_backup.sql**
3. Copie todo o conteudo (Ctrl+A depois Ctrl+C)
4. Cole em um arquivo de texto no seu computador e salve como .sql

OU:

1. Faca o Download do projeto (Parte 1 acima)
2. O arquivo database_backup.sql vai estar dentro da pasta backup/

---

## PARTE 3 - Claim do banco no Supabase (assumir controle)

Para ter acesso direto ao banco no painel do Supabase:

1. Va em https://supabase.com e crie uma conta (se nao tiver)
2. No Bolt, va em **Account settings** (configuracoes da conta)
3. Conecte sua conta Supabase ao Bolt
4. ATENCAO: voce precisa ser **dono da organizacao** no Supabase
5. Com o projeto aberto no Bolt, clique no **icone do Database**
   - Fica no **topo central** da tela (um icone de banco de dados)
6. Clique na aba **Advanced**
7. Clique em **Claim**
8. Siga os passos que aparecerem no Supabase
9. O banco vai aparecer como um projeto na sua lista do Supabase

Depois do claim, voce tem acesso completo ao banco pelo painel do Supabase:
- Editar tabelas visualmente
- Rodar SQL
- Ver logs e monitoramento
- Fazer backup pelo proprio Supabase

---

## PARTE 4 - Enviar os arquivos para o GitHub

1. No Bolt, com o projeto aberto, procure o **icone do GitHub**
   - Fica no **canto superior direito** da tela
2. Clique nele
3. Digite um nome para o repositorio (ex: "orcapro-pwa")
4. Clique em **Create repository**
5. O repositorio sera criado como **privado** na sua conta GitHub
6. Para tornar publico: va no GitHub > Settings do repositorio > troque para public

Depois disso, toda alteracao feita no Bolt pode ser enviada ao GitHub
como um "commit" pelo proprio Bolt.

---

## PARTE 5 - Restaurar em uma nova plataforma (replicar)

Se precisar recriar o app em outra conta Supabase ou outra plataforma:

### Passo 1: Criar novo projeto Supabase
1. Va em https://supabase.com > New Project
2. Escolha um nome e regiao
3. Anote a URL e as chaves (anon key, service role key)

### Passo 2: Criar as tabelas
1. No painel do novo Supabase, va em **SQL Editor**
2. Rode cada arquivo da pasta `supabase/migrations/` em ordem:
   - 20260725102831_create_budget_app_schema.sql
   - 20260725104316_add_unit_and_logos_bucket.sql
   - 20260726104220_add_service_orders_and_photos.sql
   - 20260726184115_add_technician_role_and_service_order_items.sql
   - 20260726232143_add_technician_name_and_fix_profiles_rls.sql
   - 20260727014544_fix_profiles_select_rls_recursion.sql
   - 20260727031811_add_triple_verification_security_hardening.sql
   - 20260727033856_add_labor_cost_to_budgets.sql

### Passo 3: Restaurar os dados
1. Ainda no SQL Editor, rode o arquivo `backup/database_backup.sql`
2. Todos os dados serao inseridos

### Passo 4: Recriar os usuarios
- Os usuarios (profiles) precisam ser recriados via tela de login do app
- O backup tem os emails e roles para referencia:
  - dev@orcapro.app (DEV)
  - sjc@cast.con (EMPRESA - SJC)
  - alfa@dev.com (EMPRESA - Alfa)
  - cast.servicostecnicos@gmail.com (EMPRESA - CAST)
  - cas@pwa.com (TECNICO - SJC)
  - edson@alfa.com (TECNICO - Alfa)
  - lp@alfa.com (TECNICO - Alfa)

### Passo 5: Atualizar as chaves no app
- No novo projeto, troque as chaves do Supabase no arquivo .env:
  - VITE_SUPABASE_URL
  - VITE_SUPABASE_ANON_KEY
  - SUPABASE_SERVICE_ROLE_KEY

### Passo 6: Recriar a edge function
- O arquivo esta em `supabase/functions/admin/index.ts`
- Pode ser deployado pelo painel do Supabase ou pelo Bolt

---

## Resumo do que proteger

| Item              | Onde esta                    |
|-------------------|------------------------------|
| Codigo do app     | Download do projeto (zip)    |
| Banco (esquema)   | supabase/migrations/         |
| Banco (dados)     | backup/database_backup.sql   |
| Edge function     | supabase/functions/admin/    |
| Logos/fotos       | Storage do Supabase (buckets)|
