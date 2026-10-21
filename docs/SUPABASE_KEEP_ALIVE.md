# Prevenção de Pausa por Inatividade do Supabase (Keep-Alive)

> **Contexto:** No plano gratuito (*Free Tier*) do Supabase, projetos sem requisições ou atividade por mais de 7 dias são automaticamente pausados pela plataforma.  
> **Solução Implementada:** Rotina automatizada a cada 2 dias que gera requisição externa HTTP com escrita e leitura real na base de dados, garantindo que o banco permaneça 100% ativo.

---

## 🛠️ O que foi implementado

1. **Migration SQL (`supabase/migrations/002_heartbeat.sql`):**
   - Criação da tabela `public.system_heartbeat`.
   - Função RPC autoritativa `public.rpc_heartbeat()` que faz um *upsert*, atualiza o timestamp `last_ping`, incrementa o contador `ping_count` e retorna status 200 com JSON.
   - Políticas RLS configuradas para permitir a execução segura.

2. **Workflow GitHub Actions (`.github/workflows/keep-alive.yml`):**
   - Agendamento cron automático a cada 2 dias (`0 12 */2 * *` às 09:00 BRT).
   - Execução sob demanda manual (*workflow_dispatch*) diretamente pela aba **Actions** do GitHub.
   - Faz uma requisição `POST` autenticada via HTTPS para o PostgREST do Supabase (`/rest/v1/rpc/rpc_heartbeat`).

---

## ⚙️ Passo a Passo para Ativar

### Passo 1: Executar a Migration no Supabase
1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard).
2. Entre no seu projeto e vá em **SQL Editor** no menu lateral.
3. Copie e cole o conteúdo do arquivo [`supabase/migrations/002_heartbeat.sql`](../supabase/migrations/002_heartbeat.sql).
4. Clique em **Run**.

---

### Passo 2: Configurar os Secrets no GitHub
1. Acesse o seu repositório no GitHub:
   👉 [https://github.com/kelvincpv/karaoke-da-festa/settings/secrets/actions](https://github.com/kelvincpv/karaoke-da-festa/settings/secrets/actions)
2. Clique em **New repository secret**.
3. Adicione as 2 chaves (as mesmas que você obteve no painel do Supabase em *Settings -> API*):
   - **Nome:** `SUPABASE_URL`  
     **Valor:** `https://xyzcompany.supabase.co`
   - **Nome:** `SUPABASE_ANON_KEY`  
     **Valor:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

*(Dica: O workflow também aceita os nomes `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`).*

---

### Passo 3: Testar Imediatamente
1. No seu repositório no GitHub, clique na aba **Actions**.
2. No menu à esquerda, selecione o workflow **Supabase Keep-Alive Ping**.
3. Clique no botão **Run workflow** (no lado direito) e confirme.
4. O GitHub executará a chamada em menos de 5 segundos e você verá o indicador verde de sucesso!

---

## 🌐 Alternativa Externa (Sem GitHub Actions): Cron-job.org ou UptimeRobot

Se preferir não usar o GitHub Actions, você pode configurar um monitor gratuito em ferramentas como [cron-job.org](https://cron-job.org) ou [UptimeRobot](https://uptimerobot.com):

- **URL:** `https://SEU_PROJETO.supabase.co/rest/v1/rpc/rpc_heartbeat`
- **Método:** `POST`
- **Headers:**
  - `apikey`: `SUA_CHAVE_ANON`
  - `Authorization`: `Bearer SUA_CHAVE_ANON`
  - `Content-Type`: `application/json`
- **Frequência:** A cada 2 dias (ou a cada 24 horas).
