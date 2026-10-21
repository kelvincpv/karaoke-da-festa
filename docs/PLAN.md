# Karaokê da Festa — Plano de Execução do MVP

## Visão Geral das Etapas

| Etapa | Agente Responsável | Objetivo Principal | Entregas |
|---|---|---|---|
| **Etapa 1** | Orquestrador | Arquitetura, Contratos e Planejamento | `docs/ARCHITECTURE.md`, `docs/CONTRACTS.md`, `docs/PLAN.md` |
| **Etapa 2A** | Senior Designer | Design System & Especificação de UI/UX | `docs/DESIGN_SYSTEM.md`, especificações das telas (Mobile Participante, Dashboard Organizador, TV Display Mode), tokens Tailwind |
| **Etapa 2B** | Backend Developer | Modelo de Dados, Migrations SQL & RPCs | `supabase/migrations/001_initial_schema.sql`, RPCs de fila/dueto/votação/score, RLS |
| **Etapa 3** | Frontend Developer | Scaffolding Vite+React+TS+Tailwind & Telas | Base do projeto em `C:\Users\conta\karaoke-da-festa`, componentes UI, telas Mobile, TV e Organizador, integração com YouTube e Supabase |
| **Etapa 4** | Orquestrador & Frontend & Backend | Integração e Validação do Fluxo | Testes de ponta a ponta: entrada na sala, busca YouTube, fila, dueto, player TV, reações e votação com pontuação |
| **Etapa 5** | Senior Designer | Revisão Visual e Ajustes de UI/UX | Auditoria de layout, responsividade e refinamento estético |
| **Etapa 6** | Deployer | Git, Build e Preparação de Publicação | `.gitignore`, `vercel.json`, `npm run build` verificado e repositório Git pronto |
