# Auditoria ISEQ — autenticação, sessão e obtenção de históricos

Data: 8 de outubro de 2026. Versão auditada: 0.1.1. Commit: `29ed8aaf6eba5cdcb9ee8867b7b82f1abcb272f0`.

## Escopo e evidências

Foram executadas 15 sondagens determinísticas contra `IseqClient` e os callbacks reais de `iseqDialog`/`iseqPeriodDialog`, extraídos do código para um contexto Node VM com elementos de interface substitutos. Dez falhas foram reproduzidas e cinco controles positivos passaram. Nenhuma requisição externa, credencial real, alteração de `src`, commit ou publicação foi feita nesta auditoria.

- Reprodução: `audits/2026-10-08/iseq/repro.mjs`.
- Resultado completo: `audits/2026-10-08/iseq/resultados.json`.
- Comando: `node audits/2026-10-08/iseq/repro.mjs` (exit code 0).
- Contrato de comparação: snapshot local do beta em `../reference-beta/backend/app/main.py` e `collector.py`.

Os stubs validam decisões dos callbacks e o estado que eles escrevem. Não equivalem a uma reprodução completa do navegador ou ao diagnóstico do serviço Render em produção. O screenshot do usuário corresponde ao estado esperado do código enquanto o login aguarda uma resposta: botão desabilitado, sem mensagem de andamento. A causa externa da demora, a disponibilidade atual do serviço, CORS e o login real permanecem **não confirmados** por estas sondagens.

Gravidade: P1 = bloqueio de fluxo principal; P2 = falha funcional/recuperação/diagnóstico; P3 = problema menor de estado ou recurso. As sugestões abaixo são recomendações, não correções aplicadas.

## Falhas confirmadas

| ID | Gravidade | Achado | Código |
|---|---|---|---|
| ISEQ-01 | P1 | Login pode aguardar indefinidamente, sem timeout, progresso ou cancelamento | `src/iseq.js:12`, `:20-24`; `src/main.js:81`, `:139-142` |
| ISEQ-02 | P1 | Limite de 20 minutos do histórico não interrompe uma requisição HTTP pendente | `src/iseq.js:28-38`, `:43` |
| ISEQ-03 | P2 | Mensagens estruturadas do backend são descartadas | `src/iseq.js:14-17` |
| ISEQ-04 | P2 | Resposta HTTP 200 em HTML/JSON inválido é tratada como objeto vazio | `src/iseq.js:13`, `:24`, `:43-48`; `src/main.js:156` |
| ISEQ-05 | P2 | Fechar o modal de login não cancela a operação e uma resposta tardia abre outro modal | `src/main.js:80-82`, `:140-142` |
| ISEQ-06 | P2 | Após 401, o token é apagado, mas a interface continua tratando a sessão como conectada | `src/iseq.js:15`; `src/main.js:138`, `:155` |
| ISEQ-07 | P2 | Sair da ISEQ depende da resposta remota antes de limpar a sessão local | `src/iseq.js:27`; `src/main.js:161` |
| ISEQ-08 | P2 | Erro/cancelamento do histórico deixa indicador de consulta e controlador ativos | `src/main.js:151-159`, `:81` |
| ISEQ-09 | P3 | Conta sem sensores abre seletor obrigatório vazio | `src/iseq.js:25`; `src/main.js:142`, `:149` |
| ISEQ-10 | P3 | Cada intervalo de polling conserva um listener de abort concluído | `src/iseq.js:38` |

### ISEQ-01 — login sem prazo ou cancelamento

**Passos:** fornecer um fetcher cuja Promise permanece pendente; chamar `login`; examinar suas opções. O callback da interface aguarda a mesma Promise.

**Esperado:** estado de conexão visível, possibilidade de interromper a espera e prazo explícito de resposta que recupere o botão com erro compreensível.

**Observado:** `options.signal` é `undefined`; não há temporizador/deadline na implementação. A Promise continuou pendente após 60 ms de observação controlada. O código genérico desabilita o submit e só o reabilita no `finally`, depois da conclusão. Não há mensagem de andamento ou controle de cancelamento no login. A ausência de prazo é confirmada por inspeção do código, e não inferida apenas dos 60 ms da sonda.

**Correção proposta:** sinal próprio por tentativa, timeout que aborte o fetch, cancelamento ao fechar, indicação de etapa/tempo e limpeza imediata do campo de senha após obter a entrada necessária.

### ISEQ-02 — deadline do histórico só existe entre respostas

**Passos:** devolver um job criado; deixar a consulta de status pendente; avançar `Date.now` sinteticamente em 60 minutos.

**Esperado:** encerramento por timeout após o prazo de 20 minutos, mesmo sem resposta HTTP.

**Observado:** a Promise permanece pendente. A checagem de deadline acontece somente após `await request(...)`; a criação inicial do job e a paginação também não são cobertas por esse prazo. O relógio simulado evita aguardar uma hora real e não testa latência de rede.

**Correção proposta:** deadline/cancelamento que alcance cada requisição e a operação completa, com diferenciação entre timeout e cancelamento solicitado.

### ISEQ-03 — `detail` objeto perdido

**Passos:** responder HTTP 401 com `{ "detail": { "code": "session_invalid", "message": "Sua sessão terminou. Entre novamente." } }`.

**Esperado:** exibir a mensagem e disponibilizar o código/status para a recuperação da sessão.

**Observado:** o erro vira apenas `O backend retornou erro 401.`. O beta de referência realmente usa `detail.code` e `detail.message` (`backend/app/main.py:116-135`); não é um formato hipotético criado para a sonda. Erros de credenciais e indisponibilidade também adotam esse contrato (`:202-220`). O formato `detail` string, por outro lado, é preservado corretamente no controle positivo.

**Correção proposta:** normalizar `detail` objeto/string sem descartar a mensagem, o código e o status HTTP.

### ISEQ-04 — HTML/JSON inválido confundido com ausência de dados

**Passos:** simular HTTP 200 cujo `.json()` rejeita por receber HTML; usar tanto o endpoint de login quanto a página de dados de um job concluído.

**Esperado:** informar que o serviço respondeu em formato inesperado, sem interpretar a resposta como dados válidos.

**Observado:** a falha de parsing é transformada em `{}`. No login aparece `O backend não devolveu uma sessão válida.`. No histórico `historical()` resolve com `rows: []`; a interface então informa `Nenhum registro foi recebido nesse período.`, atribuindo a falta de registros ao período. Isso permite confundir uma página de carregamento/erro com um histórico vazio.

**Limite:** o comportamento com HTML foi confirmado em fixture. Esta sonda não confirma que o endpoint real devolve HTML hoje ou que o cold start do Render seja a causa do travamento atual.

**Correção proposta:** validar parsing e formato das respostas; rejeitar HTML, ausência de `rows` ou esquema incompatível com diagnóstico próprio.

### ISEQ-05 — resposta tardia reabre fluxo fechado

**Passos:** iniciar login pendente; fechar o elemento do modal; resolver o login com sessão e equipamento sintéticos válidos.

**Esperado:** fechamento encerra a tentativa local; uma resposta tardia não altera a navegação nem reabre o fluxo.

**Observado:** o callback continua, registra sessão/equipamentos e abre `Selecionar histórico ISEQ`. O campo de senha permaneceu preenchido enquanto aguardava; foi limpo apenas após resolver a Promise. Não foi constatado envio da senha a exportações ou arquivos.

**Correção proposta:** abortar ao fechar e invalidar a tentativa por identificador; conferir se o modal/tentativa permanece ativo antes de atribuir sessão ou abrir o próximo passo.

### ISEQ-06 — sessão expirada sem volta ao login

**Passos:** efetuar login sintético; responder 401 ao iniciar histórico; chamar novamente `iseqDialog`.

**Esperado:** reconhecer sessão expirada, limpar estado de conexão e apresentar autenticação.

**Observado:** o cliente remove corretamente seu token, mas `iseq` e `equipment` continuam preenchidos no módulo principal. `iseqDialog` abre `Selecionar histórico ISEQ`, porque testa apenas o objeto cliente e a lista. Nova requisição já não tem Authorization e falha novamente. É possível acionar Sair, mas esse caminho sofre ISEQ-07 se o backend não responder.

**Correção proposta:** propagar uma falha de sessão identificável e sincronizar estado principal, com retorno explícito ao login.

### ISEQ-07 — logout local espera serviço remoto

**Passos:** autenticar; fazer `/api/auth/logout` retornar uma Promise pendente; acionar o callback Sair; realizar uma sonda de requisição adicional.

**Esperado:** apagar token e estado local imediatamente; tentar revogar sessão remota com prazo limitado.

**Observado:** o modal não fecha, `iseq` continua presente e a requisição posterior ainda recebe o token. A limpeza no cliente fica no `finally` depois do `await`, e a limpeza principal também ocorre depois do `await` de logout. Não se constatou acesso indevido por terceiros; o achado é a incapacidade de encerrar a sessão local quando o serviço demora ou trava.

**Correção proposta:** guardar somente os dados necessários à revogação e limpar estado local antes de aguardar o servidor.

### ISEQ-08 — consulta aparenta seguir após falha

**Passos:** iniciar o callback de importação e fazer `historical()` rejeitar com erro controlado.

**Esperado:** remover o indicador de consulta/cancelamento, limpar controlador e restaurar estado de tentativa concluída.

**Observado:** continuam no HTML o spinner e `Cancelar espera`; a variável `controller` permanece preenchida. O handler genérico apresenta erro e reabilita submit, mas não desfaz o progresso específico da ISEQ. O controlador só é zerado no caminho de sucesso. O mesmo caminho de rejeição é usado pelo abort.

**Correção proposta:** tratamento `try/catch/finally` do fluxo histórico, mantendo erro/cancelamento explícitos e limpando estado de progresso em todos os finais.

### ISEQ-09 — equipamento vazio sem explicação

**Passos:** login devolve sessão válida e `equipment: []`; endpoint secundário também devolve lista vazia.

**Esperado:** mostrar que a conta não tem sensores disponíveis, com tentativa de atualizar e saída/retorno ao login.

**Observado:** é aberto um formulário com `<select required>` sem opções e sem mensagem de lista vazia. Não há histórico a selecionar.

**Correção proposta:** estado vazio explícito antes de abrir o formulário de período.

### ISEQ-10 — listeners de abort acumulados

**Passos:** simular três status `running` seguidos de `completed`; acelerar os intervalos de 2,5 s; contar registros e remoções do sinal.

**Esperado:** cada listener temporário é removido quando a espera conclui.

**Observado:** três listeners adicionados e zero removidos. `{ once: true }` remove um listener quando há abort, não quando seu timer termina normalmente. Operações longas acumulam closures/handlers até o sinal ser descartado. Não foi comprovado travamento ou crescimento expressivo de memória decorrente disso; é uma falha menor de ciclo de vida.

**Correção proposta:** retirar o listener na conclusão e no cancelamento da espera.

## Controles positivos

1. **Paginação:** 25.001 linhas obtidas com offsets 0 e 25.000, sem duplicação; ambas as páginas foram preservadas.
2. **Abort do histórico:** uma requisição de status pendente com fetcher que respeita `AbortSignal` rejeitou com `AbortError` após cancelamento. O botão não cancela o job remoto, mas é rotulado “Cancelar espera”; não se considera isso um bug por si só.
3. **Formato histórico:** `data_local` e todos os nove parâmetros conhecidos do beta foram reconhecidos (`wide`).
4. **Identidade do equipamento:** para o contrato real de referência `{mac, location, label}`, o MAC selecionado foi enviado em `equipment_id` e preservado em `pending.context.sensorId`; nome e linhas sintéticas foram mantidos. Não foi encontrado bug de IDs nesse contrato.
5. **Erro string:** `detail: 'Erro controlado explícito'` foi exibido sem alteração.

O beta de referência normaliza equipamentos para objetos com MAC válido (`collector.py:146-167`) e fornece páginas de até 25 mil linhas com `offset`/`has_more` (`main.py:328-344`). Equipamentos sem IDs ou um backend alternativo que muda esses esquemas são cenários de contrato inválido não exercitados nesta rodada, não bugs reais de sensores confirmados.

## Prioridade recomendada

1. Corrigir ISEQ-01/02 e apresentar estado de conexão, timeout e cancelamento; reproduzir login lento/pendente em navegador sem credenciais reais.
2. Sincronizar sessão e encerramento: ISEQ-05/06/07; validar respostas e preservar erros: ISEQ-03/04.
3. Limpar estado em todos os finais: ISEQ-08; tratar lista vazia e listeners: ISEQ-09/10.
4. Só depois validar o contrato em produção com credenciais inseridas pelo próprio usuário e período curto, sem publicar os registros.

A auditoria confirma os achados reproduzidos neste escopo; não fornece garantia de ausência de outros bugs nem validação de autenticação/dados reais.
