# Auditoria DevOps e escalabilidade — 28/10/2026

Responsável: devops-engineer, tarefa #26726579. Repositório existente preservado; este relatório complementa os documentos históricos de deploy, sem revalidar as declarações de homologação neles contidas.

## Ambiente e baseline executado

- Windows/PowerShell, Node v24.22.0, npm 11.19.1; HEAD inicial `44c6f21cbc571fc1839021dcdc5fcc3402d50b4e`. Outros agentes trabalham simultaneamente neste checkout.
- Nenhum `AGENTS.md` encontrado no repositório nem nos diretórios ancestrais consultados.
- `npm run build`: **exit 0**, aplicação TypeScript + Vite e extensão Chrome TypeScript/copiar popup. Vite 6.4.4, 1695 módulos, bundling 11,04 s. HTML 1,20 kB (gzip 0,68), CSS 50,08 kB (gzip 8,37), JS 594,60 kB (gzip 162,50). Aviso de chunk >500 kB. Duração Vite não é duração total do comando.
- `npm audit --json`: **exit 1**, 2 ocorrências moderadas (react-router e react-router-dom), zero altas/críticas. Advisory IDs `GHSA-wrjc-x8rr-h8h6` e `GHSA-337j-9hxr-rhxg`, reportadas pelo registry consultado. Correção automática proposta migra para major 7.18.5; não foi aplicada. Security avalia aplicabilidade à SPA e correções compatíveis.
- `npm run typecheck`: **exit 0**, verifica app, configuração Vite e extensão sem emitir arquivos.
- `npm ci --no-audit --no-fund` em diretório temporário novo, com cópias do package/lock baseline: **exit 0**, 160 pacotes instalados em 43 s; não alterou node_modules compartilhado. npm 11.19.1 avisou sobre postinstall esbuild sem allowScripts; o comportamento de lifecycle precisa ser revalidado no npm fornecido pelo runner Linux. Essa execução validou instalação, não build Linux.
- `npm audit --audit-level=high`: **exit 0**, reporta as mesmas duas ocorrências moderate e aplica o limiar configurado no CI.
- Não há Docker ou Supabase CLI disponíveis no PATH; não há `supabase/config.toml`. Apenas `.env.example` foi encontrado entre arquivos `.env*`; nenhum nome de variável VITE_/SUPABASE_/YOUTUBE_ estava definido no processo consultado. Valores não foram coletados nem publicados.

## Mudanças incrementais e CI

Adicionados `typecheck`, `test` (Vitest unit/integration em jsdom) e `test:e2e` (Playwright) ao package.json e workflow `.github/workflows/quality.yml`: Node 24, instalação por lockfile (`npm ci`), tipagem, testes Vitest, build completo, auditoria com bloqueio em high/critical e artefatos por sete dias. Permissão somente leitura de contents, concorrência cancelável por ref e limite de quinze minutos. Não publica deploy nem necessita credenciais de produção. Solicitação de revisão enviada ao QA. Instaladas somente ferramentas de teste: Vitest 4.1.12, jsdom 27.4.0, Testing Library React 16.3.3 e Playwright 1.64.1, registradas no lockfile. Não houve upgrade major de dependências de aplicação. Configurações e cenários são responsabilidade QA; E2E ainda depende da configuração de servidor local do QA e não está ligado ao gate CI nesta etapa.

O workflow foi inspecionado localmente; sua execução em GitHub Actions ainda não foi observada. O gate high permite explicitamente as duas ocorrências moderate já registradas; não equivale a ausência de vulnerabilidades. Não há ESLint configurado; o typecheck não substitui lint ou testes funcionais.

O workflow existente `keep-alive.yml` permanece intacto: executa RPC remoto agendado com secrets do GitHub; não foi acionado durante a auditoria. Não é monitoramento contínuo nem valida integridade da sessão. Recomenda-se timeout explícito no curl/job, credenciais em env do step e evitar imprimir corpo irrestrito de resposta em futura revisão desse workflow.

## Ambiente e implantação

SPA estática Vite/React, Supabase externo para PostgreSQL/Realtime; não há processo backend Node para escalar na Vercel. `vercel.json` contém rewrite SPA e cache de assets com hash; cabeçalhos efetivos em rotas reescritas precisam de validação HTTP em preview autorizado. Não houve publicação nem chamada a produção.

`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` constam no template. `VITE_YOUTUBE_API_KEY` é consumida pelo código mas não documentada no template atual. Os aliases `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `YOUTUBE_API_KEY` são aceitos pelo código. Prefixos VITE_, SUPABASE_ e YOUTUBE_ são habilitados no Vite: valores usados no cliente são públicos; nunca configurar chave administrativa/service_role sob prefixos expostos. Security foi notificado da amplitude dos prefixos. Ausência de configuração ativa fallback, e um build sem credenciais não prova integração Supabase funcional.

Extensão possui artefatos dist rastreados pelo Git e manifest fora de dist. Build os regenera; mudanças de fonte da extensão precisam de verificação correspondente dos artefatos pelo responsável. Artifact CI inclui manifest + dist para revisão. Instalação manual, permissões e comportamento externo são escopo das auditorias frontend/security.

Antes de liberar produção: testes revisados, preview funcional com ambiente isolado, aplicação controlada das migrações pelo responsável e rollback documentado (deploy anterior + compatibilidade de schema). Não executar SQL consolidado ou cleanup no banco produtivo como parte da validação. Publicação continua dependente de autorização explícita.

## Escala: modelo analítico do baseline, não benchmark

Fonte: `src/services/roomRealtimeService.ts`, uma conexão/canal por instância do serviço; presença, broadcast e seis handlers Postgres Changes (queue_items, participants, performances, ratings, rooms DELETE/UPDATE). A quantidade real de sockets depende de abas/instâncias e deve ser medida. `eventsPerSecond: 10` no cliente não demonstra capacidade do servidor nem proteção global contra abuso.

Hipóteses explícitas: P participantes, um organizador e um telão separados, C=P+2 clientes por sala, todos persistidos e conectados; heartbeat individual a cada 45 s; cada UPDATE em participants é entregue a C assinantes e causa uma leitura da lista em cada um. Sem batching, perda, throttling ou políticas que reduzam entregas. Modelo de heartbeat: writes/s = R*C/45; callbacks/SELECTs/s = R*C²/45. Os valores excluem entradas, fila, ratings, reações, presença, polling do player e buscas YouTube. Plano multi-sala usa 30 participantes/sala para tornar o cenário explícito.

| Salas | Participantes/sala | Clientes totais modelados | Heartbeat writes/s | Callbacks e SELECTs/s do heartbeat |
|---:|---:|---:|---:|---:|
| 1 | 10 | 12 | 0,27 | 3,20 |
| 1 | 30 | 32 | 0,71 | 22,76 |
| 1 | 100 | 102 | 2,27 | 231,20 |
| 10 | 30 | 320 | 7,11 | 227,56 |
| 50 | 30 | 1600 | 35,56 | 1137,78 |

Se cada cliente envia uma reação a cada 10 s, ingressos de reação são R*C/10 por segundo e entregas broadcast aproximadamente R*C²/10 (self=true). Para 102 clientes: 10,2 ingressos/s e 1040,4 entregas/s. Não somar indiscriminadamente a contagem ao custo financeiro do provedor: faturamento depende do plano vigente e do tipo de mensagem. Nenhum custo monetário foi estimado sem plano e métricas reais.

Risco P1 potencial comunicado imediatamente ao lead/backend: UPDATE somente de last_active_at dispara recarga completa dos participantes em todos os clientes. Além disso, alterações de fila provocam até duas consultas por assinante e ratings provocam RPC de ranking, com SELECT fallback em alguns estados. Crescimento quadrático do tráfego do heartbeat deve ser evitado antes de inferir suporte a 100 participantes. Alternativas incrementais sob revisão backend: ignorar mudanças exclusivamente de heartbeat usando payload confiável, separar tráfego de liveness da lista visível ou coalescer leituras por sala/cliente. Evitar cache ou infraestrutura adicional sem medir o gargalo.

O schema inicial já contém índices por room_id, sessão, atividade de participantes, status/ordem da fila e performances por sala/completed_at. A presença desses DDL no repositório não comprova que foram aplicados no ambiente remoto nem que atendem a planos reais de consulta; confirmar por catálogo e EXPLAIN no ambiente isolado antes de propor índices adicionais. Cada heartbeat também atualiza a coluna indexada last_active_at, cujo custo de escrita precisa ser observado.

### Medições reais pendentes e protocolo de carga isolada

**Carga real não executada:** não existe backend Supabase local preparado nem credenciais isoladas fornecidas. Frontend demo não reproduz banco/Realtime e um teste de servidor estático não validaria esses cenários. Latência p50/p95/p99, eventos entregues/perdidos, conexões observadas, CPU/RSS do servidor, leituras e requests reais permanecem **não medidos** para todos os cinco cenários. Não há conclusão de capacidade ou SLA.

Preparar Supabase local com schema/migrações revisados por backend, dados sintéticos e endpoints explicitamente loopback; nunca reutilizar variáveis de produção. Confirmar APIs/RPCs atuais e autorização antes de preparar o gerador. Executar os cenários individualmente com rampa de 60 s, estabilização 120 s e janela 300 s; incluir abas organizer/TV, cada participante com identidade própria, fila concorrente, reação a cada 10 s, rating único por performance, reconexão de 10% dos clientes e isolamento entre salas. Esses tempos são proposta, não execução registrada.

Coletar IDs únicos/correlação nos eventos e marcas de envio/recepção em relógio monotônico do mesmo host; para múltiplos hosts registrar desvio de relógio. Medir p50/p95/p99 ponta a ponta, duplicatas/perdas, sockets estabelecidos/recuperados, bytes e mensagens/s, requests HTTP por operação e sala, erros/timeouts, duração de RPC, leituras/locks/query plans, CPU e RSS por container e gerador. Registrar configuração da máquina, versões, duração e arquivos brutos por cenário. Gerador e serviço precisam de métricas separadas para não confundir saturação do cliente com capacidade do backend. Interromper em crescimento sustentado de memória, erros persistentes ou perda de estado; limpar apenas dados sintéticos do ambiente isolado pelo procedimento aprovado. Critério obrigatório: sem avanço duplicado, sem rating repetido e sem eventos entre salas. Limites de latência devem ser acordados com produto, não inventados como resultado.

## Observabilidade

Baseline contém console.warn/log/error, health check com latência pontual e estados subscribe; sem exportação central de métricas, histórico, tracing ou alertas. Algumas chamadas retornam `{ error }` sem lançar exceção; try/catch não garante observabilidade desses erros. Falhas de heartbeat e playback persistido são silenciosas em trechos auditados. `checkSupabaseHealth` pode retornar connected=true com schemaPending=true: readiness precisa também de schema pronto, não apenas transporte acessível.

Priorizar métricas agregadas sem nomes/tokens/payload completo: estado e tempo da conexão, reconexões, erro RPC/PostgREST por operação, atraso de sincronização, fila de eventos, avanço deduplicado e falha de player por código. Correlação por ID efêmero da sala/operação, amostragem e retenção limitada. Alertas iniciais devem detectar erro persistente de conexão, readiness schema pendente e falha repetida de avanço; ajustar limiares após baseline real. UI deve mostrar desconexão/recuperação, com responsabilidade frontend/backend, antes de criar integração externa de monitoramento.

## Evidência final integrada

Nova validação do checkout em integração às 19:51 UTC: `npm run build` **exit 0**, 1697 módulos, Vite 5,81 s, HTML 1,20 kB/gzip 0,68, CSS 50,25 kB/gzip 8,40, JS 600,11 kB/gzip 164,78, mesmo aviso >500 kB; extensão também compilada. `npm run typecheck` **exit 0** em seguida.

Primeiro `npm test` executado com as novas ferramentas: **exit 1**, 48 passaram e 4 falharam de 52 testes em cinco arquivos (quatro arquivos passaram). Falhas em integração roomRealtime: duas expectativas de nenhum callback recebem estado inicial vazio, recuperação da fila recebe lista vazia e participante consegue reordenar. Resultados comunicados a QA/backend/lead imediatamente; não foram alterados os testes/código sob responsabilidade deles. Mudanças simultâneas ainda em andamento: isso não representa aprovação funcional ou o fechamento integrado final.

Pendentes: ajuste/validação das quatro falhas pelos responsáveis, configuração/execução E2E isolada, retorno da revisão QA de CI/testes e sinal dos demais responsáveis para novo build de fechamento. Não foi executado deploy, migração nem teste contra serviços de produção.

## Revalidação de 28/10/2026, 20:02 UTC

Follow-up DevOps após configuração explícita `vitest.config.ts` e restrição do Vite a seis nomes públicos (três VITE_ e três aliases):

- `npm test`: exit 0; cinco arquivos, **54/54 testes aprovados**, duração Vitest 2,27 s. Substitui o resultado anterior com quatro falhas para este checkout.
- `npm run typecheck`: exit 0, aplicação, configuração Vite e extensão.
- `npm run build`: exit 0, aplicação e extensão, 1697 módulos, Vite 6,58 s; JS 600,93 kB/gzip 165,03. Aviso de chunk >500 kB permanece.
- `resolveConfig` do Vite com sentinelas sintéticas: exit 0; nomes privados `VITE_PRIVATE_SENTINEL` e `SUPABASE_SERVICE_ROLE_KEY` ausentes do env público/define, nome público permitido resolvido corretamente. Nenhum segredo real usado. Esta validação cobre configuração, não uma análise completa do bundle.

Correção da descrição de ambiente anterior: `envPrefix: []` desabilita exposição genérica por prefixo e `define` libera apenas os seis nomes públicos explícitos. Chaves administrativas não devem ser fornecidas sob nomes da allowlist, cujos valores são públicos.

Solicitação de revisão CI/testes reiterada ao QA. O build acima comprova o checkout observado; fechamento após integração estabilizada depende de sinal dos responsáveis. E2E/revisão QA e carga real Supabase continuam pendentes, sem aprovação funcional/produção ou alegação de capacidade. Nenhuma implementação de terceiros foi alterada nesta retomada.

## Follow-up Playwright (28/10/2026, 20:07 UTC)

QA revisou CI/Vitest e transferiu a reserva de playwright.config.ts para DevOps. Adicionada configuração com tests/e2e, Chromium, baseURL http://127.0.0.1:5173 e webServer Vite em loopback; reuseExistingServer somente fora de CI. Nenhuma edição em tests/** ou fixtures.

- npm run test:e2e -- --list: exit 0, dois testes Chromium descobertos.
- npm run test:e2e -- --output=node_modules/.cache/playwright-results: exit 1, um teste passou (criação/QR), um falhou após 30 s aguardando Buscar Música em tests/e2e/party.spec.ts:53 (página voter). Resultado total 37,3 s. Evidência local em node_modules/.cache/playwright-results. Encaminhado ao QA; sem afirmar aprovação funcional completa.
- quality.yml ainda não executa E2E. Para habilitar após estabilização da suíte, instalar Chromium no runner com npx playwright install --with-deps chromium antes de npm run test:e2e.

Tarefa DevOps segue em andamento aguardando correção/revisão E2E e sinal de integração para build final. Carga real continua sem ambiente Supabase isolado.

## Gate Playwright no CI (28/10/2026, 20:17 UTC)

Após QA registrar a não reprodução da falha anterior, `quality.yml` passou a instalar Chromium com `npx playwright install --with-deps chromium` e executar `npm run test:e2e -- --output=test-results` antes do build. Evidências existentes em `test-results/` são publicadas em falha por sete dias. Os demais gates permanecem: instalação por lockfile, typecheck, Vitest, build app/extensão e audit high/critical.

Validação local Windows executada nesta retomada:

- `CI=true npm run test:e2e -- --output=node_modules/.cache/playwright-ci-results` (env definido via PowerShell): exit 0, Chromium **2/2**, 18,9 s, servidor Vite iniciado pelo Playwright sem reuse.
- `npm test`: exit 0, **56/56**, cinco arquivos, 4,32 s.
- `npm run typecheck`: exit 0, app/configuração/extensão.

A suíte usa fixtures de Supabase e player YouTube simulado; bloqueia HTTPS externo. Esses resultados comprovam os cenários automatizados locais, não integração Supabase/YouTube real, homologação ou capacidade de carga. A instalação Linux `--with-deps` e o workflow GitHub Actions ainda não foram executados neste ambiente. Revisão do gate solicitada ao QA; build final permanece aguardando sinal de estabilização das integrações pelo lead. Não houve deploy, migração ou acesso produtivo.

## Integrated checkout validation — 2026-10-29, 01:06 UTC

This entry records a fresh local Windows validation and preserves the earlier audit history.

- `npm run typecheck`: exit 0, application, Vite configuration, and extension.
- `npm test`: exit 0, **56/56 tests**, five files, 36.61 s.
- `CI=true npm run test:e2e -- --output=node_modules/.cache/playwright-final-results`: exit 0, **2/2 Chromium smoke tests**, 41.4 s; local server started without reuse. Supabase and YouTube are mocked; external HTTPS is blocked by the suite.
- `npm run build`: exit 0, application and extension; 1697 modules, Vite 18.68 s. Main JS 603.65 kB / gzip 165.65 kB; CSS 50.25 kB / gzip 8.40 kB. The >500 kB warning remains.

These results describe the observed checkout, not a frozen final integration. Backend task #61b83f63 is actively fixing stale replacement snapshots/lifecycle, and #04c9711d queues heartbeat amplification work. The final integration build must follow those changes and their regression tests. QA confirmation of the newly added Chromium CI gate was requested again; the prior review predates that addition. Linux GitHub Actions execution has not been observed.

Real Supabase load remains unexecuted: Docker and Supabase CLI are unavailable in PATH and no isolated backend has been provided. All five scale scenarios remain analytical plans; latency, CPU, RSS, requests, and delivered-event capacity have not been measured. Production deployment, remote migrations, and live-service tests were not performed.

Next step: backend completes/reviews #61b83f63 and #04c9711d, QA confirms the CI gate, then DevOps reruns the integrated quality/build commands. The current task is waiting on that integration evidence rather than claiming final acceptance.

## First GitHub delivery scope — 2026-10-29

The `devops/validated-audit-20261029` delivery contains the public Vite environment allowlist, this audit, and the recurring publication policy. CI/test tooling and application changes described earlier remain in the shared development checkout pending owner/review coordination; references above are local implementation evidence and do not imply those files are in this delivery branch.

The delivery was checked in a separate worktree based on committed main (44c6f21), with only the Vite configuration changed. `npm run build` passed for app and extension: 1695 modules, JS594.60kB/gzip162.50, >500kB warning. The worktree reused the installed development node_modules through a junction; this is not a clean lockfile installation or Linux CI result. Synthetic resolveConfig assertions passed: private prefix variables absent and the allowed public URL present. Generated extension output was excluded from the commit. Main remains unchanged; no production deployment was requested or executed.
