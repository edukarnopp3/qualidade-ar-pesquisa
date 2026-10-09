# Integração ISEQ — versão 0.1.3

## Entrega

A conexão agora consulta a prontidão do serviço antes de enviar o login. O histórico apresenta etapas concluídas, dados reutilizados do cache e consultas novas. Um diagnóstico transitório mede o tempo do serviço, entrada/lista de sensores, criação do job, espera pela coleta, download e preparação local.

O diagnóstico só conserva rótulos fixos, tempos, status HTTP e contagens. Fica na memória da página e pode ser copiado por ação explícita. Não entra em originais, pacotes, `localStorage`, console ou analytics; não contém usuário, senha, token, identificadores, datas consultadas, leituras ou respostas brutas. Encerrar a sessão limpa os resumos. O backend existente continua com seu armazenamento próprio de históricos/sessões.

## Comportamento

- `GET /api/health` é público, sem autorização, cookie ou cabeçalho JSON. A espera tem prazo próprio de 90 segundos, com cancelamento e tentativas limitadas quando há rede pendente, HTML de inicialização, timeout ou erro 5xx.
- Somente uma confirmação JSON compatível libera o login. `auth_ready: false` bloqueia a transmissão. Saúde confirma resposta da aplicação; não comprova ISEQ ou credenciais.
- Em backend personalizado com rota de saúde ausente (404/405), a interface indica que a verificação não está disponível e mantém o login direto consentido. No backend padrão, uma rota ausente é erro.
- Autenticação não é repetida automaticamente. Permanecem os prazos de 45 segundos por chamada autenticada, 20 minutos por operação histórica e 8 segundos para logout remoto.
- Uma lista vazia já enviada no login é válida e não provoca outra chamada de lista. Lista ausente conserva a consulta complementar.
- O cliente valida as contagens do job e exibe os campos fornecidos; backends legados sem contagens mantêm a mensagem textual. `download_tasks` significa todas as tarefas novas, incluindo as já concluídas; não é o número restante.
- Quando o job criado já vem concluído, por exemplo em uma faixa integralmente em cache, o cliente passa direto às páginas e dispensa uma consulta de status adicional. Não presume cache quando não recebe contagens.
- Download continua sequencial em páginas de até 25 mil linhas, limite imposto pelo backend, e 250 mil no total. Cancelar/atingir o prazo local não garante parar o job remoto.
- O progresso usa estado acessível separado do formulário ocupado, contagens textuais e barra nativa. O relógio não é anunciado a cada segundo. Resumos ficam disponíveis nas telas seguintes e podem ser reabertos pela entrada ISEQ durante a sessão.

## Verificação

Suíte completa: **116 testes aprovados**, incluindo health lento/HTML/falho, ausência de rota em backend custom, cancelamento sem POST de login, credenciais não repetidas, resposta antiga de sessão, contagens inválidas, cache concluído sem polling extra, lista vazia sem consulta redundante, paginação e sanitização do diagnóstico. Build de produção concluído.

No navegador, respostas integralmente fictícias exercitaram espera de inicialização, cancelamento com recuperação do formulário, backend legado, falha de autenticação, progresso com 3 de 9 etapas reutilizadas, transferência e preparação local, cópia do resumo e limpeza no logout. A entrada sintética chegou ao processamento local com 288 linhas e 2.592 observações. Foram conferidos tema claro/escuro e layout de 390 px; a largura interna do diálogo não excedeu sua largura visível, e o botão de cópia aberto tem 44 px de altura. Estas verificações não constituem auditoria WCAG completa.

Evidências:

- [Diagnóstico no build de produção](evidencias/v0.1.3/diagnostico-producao.png).
- [Detalhes e cópia do resumo](evidencias/v0.1.3/diagnostico-producao-detalhes.png).
- [Diagnóstico em tela de 390 px](evidencias/v0.1.3/diagnostico-producao-390.png).
- [Resultado da suíte](evidencias/v0.1.3/testes.txt).
- [Benchmark sintético](evidencias/v0.1.3/benchmark-sintetico.json).

## Benchmark e decisão de paralelismo

O script `node scripts/benchmark-iseq.mjs` não faz conexões externas. Com nove tarefas artificiais de 40 ms, cinco repetições e cache isolado, a mediana foi 250,83 ms com dois workers e 156,17 ms com três. A repetição integralmente coberta fez duas chamadas (criação e dados), sem polling nem tarefas novas; mediana de 31,63 ms com dois workers. O ensaio também transferiu 100 mil linhas em quatro páginas e mediu serialização, parse e hash em Node.js.

Esses tempos medem uma simulação controlada, não a ISEQ nem o navegador do pesquisador. O padrão continua em **dois workers**. Três só deve ser adotado depois de demonstrar ganho repetível sem aumentar falhas/retentativas em uma comparação real adequada. Repetir o mesmo período após importação mede o efeito do cache e não serve para comparar concorrência de exportação.

Para reproduzir a interface, execute `node scripts/iseq-fixture-server.mjs`; no formulário, use `http://127.0.0.1:8877/uncached` ou outro cenário listado no script, com usuário/senha `sintetico`. O servidor aceita apenas credenciais fictícias e escuta em loopback; não acessa a ISEQ nem persiste corpos. Marque a entrada como sintética na conferência.

## Observação real e pendências

Uma consulta pública sem credenciais a `https://iseq-export-backend.onrender.com/api/health` expirou em **95,08 segundos**. No navegador, a mesma rota exibiu “Render — Application loading” e permaneceu sem JSON compatível nas observações posteriores. [Captura do serviço](evidencias/v0.1.3/backend-real-carregando.png).

Isso identifica uma espera anterior à autenticação naquele momento. Não comprova plano gratuito, causa interna do atraso, disponibilidade da ISEQ ou tempo do login real. Nenhuma credencial real foi enviada e o beta/serviço existente não foi alterado.

Permanecem para decisão condicionada às medições reais: consultar configuração/logs da hospedagem; validar login e uma faixa curta; confirmar cache; comparar 2/3 workers; e considerar backend sempre ativo. A instrumentação permitirá medir essas etapas quando o serviço responder. Um endpoint de status resumido, páginas maiores ou transferência de preparação para worker só se justificam se aparecerem como parcela relevante; páginas maiores exigem mudança do limite do backend em implantação isolada.

## Publicação

O registro do commit, workflow e conferência pública acompanha [EXECUCAO.md](EXECUCAO.md). A mudança foi aplicada no projeto separado `qualidade-ar-pesquisa`; preservou o método analítico `descritivo-2` e o beta.
