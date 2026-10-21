# Karaokê da Festa — Arquitetura do Sistema

## 1. Visão Geral
Aplicação web multiplayer em tempo real para festas e eventos com karaokê.
- **Participante (Mobile-first):** Entrada sem login obrigatório via código/QR Code, escolha de apelido, busca de músicas no YouTube, entrada na fila com suporte a dueto, envio de reações flutuantes ao vivo, avaliação de 1 a 5 estrelas das apresentações e visualização de rankings individuais e de duplas.
- **Organizador (Tablet/Desktop):** Criação e controle da sala, moderação e reordenação prioritária da fila, controle do player, abertura/encerramento de votação, estatísticas e encerramento de sala.
- **TV / Telão (Display Mode):** Player oficial do YouTube com sincronização de letra/áudio, exibição do cantor atual e próximo, QR Code para conexão, overlay de reações em tempo real (emojis flutuantes), tela de votação e pódio/ranking interativo.

## 2. Tecnologias
- **Frontend:** React 18+, TypeScript, Vite, Tailwind CSS, Lucide React, TanStack Query, Zustand, React Router DOM, Canvas-Confetti, YouTube IFrame Player API.
- **Backend / BaaS:** Supabase (PostgreSQL, Supabase Realtime, Supabase Auth para organizadores, Row Level Security, Stored Procedures/RPCs).
- **Deploy:** GitHub + Vercel (SPA routing, environment variables, preview deploys).

## 3. Divisão de Responsabilidades da Equipe
- **Orquestrador (Google Antigravity):** Planejamento, contratos de dados, supervisão, integração entre frontend e backend, revisão de código e aprovação técnica.
- **Senior Designer (UI/UX):** Design System (tokens, cores neon/dark, tipografia, espaçamentos), especificações de componentes e fluxos completos de Telas (Participante, Organizador, TV).
- **Backend Developer:** Esquema do banco de dados PostgreSQL no Supabase, migrations, triggers, RPCs (cálculo de score, votação segura, fila round-robin), regras de RLS e documentação dos tipos TypeScript de banco.
- **Frontend Developer:** Implementação do app em React+Vite+Tailwind, integração das views especificadas pelo Designer, consumo dos contratos do Backend via Supabase Client e YouTube Player API.
- **Deployer:** Configurações de repositório Git, .gitignore, CI/CD, Vite SPA routing (vercel.json), variáveis de ambiente e verificação de build/preview.
