# Plano para reduzir a espera da integração ISEQ

**Estado:** etapas de instrumentação, prontidão e progresso implementadas na 0.1.3; comparação de workers executada com simulação. Decisões de paralelismo/hospedagem e validação autenticada reais continuam pendentes. Consulte [a entrega e suas evidências](ISEQ-0.1.3.md).

**Base:** aplicativo 0.1.2 e contrato do backend reaproveitado pelo beta.
**Objetivo:** identificar em que etapa o tempo é gasto e melhorar a espera sem expor credenciais, perder o cache ou enviar consultas excessivas à ISEQ.

## Decisão de arquitetura

Manter o navegador conectado ao backend existente. Não transferir autenticação da ISEQ para o navegador e não reescrever o backend antes de medir o fluxo atual. O backend do beta já organiza tarefas, consulta a cobertura armazenada e evita exportar novamente os períodos que o banco já cobre. O novo aplicativo não substitui nem altera o beta.

O primeiro diagnóstico separará quatro tempos:

1. backend acordar e responder;
2. autenticação ISEQ e lista de sensores;
3. criação e execução do trabalho histórico, distinguindo cache de novas consultas;
4. transferência das páginas e preparação dos dados no navegador.

Sem essa separação, aumentar o número de consultas ou o prazo pode apenas esconder a etapa lenta.

## Estado atual observado

- O conector usa `https://iseq-export-backend.onrender.com` como endereço padrão, com prazos de 45 segundos por requisição e 20 minutos por operação. A página já mostra tempo decorrido e permite cancelar a espera. Consulte [src/iseq.js](../src/iseq.js) e [docs/MANUAL.md](MANUAL.md).
- O login usa o endpoint `/api/auth/iseq/login` e a resposta costuma incluir os sensores; se não incluir uma lista não vazia, o cliente faz uma consulta adicional. Hoje a interface mostra login e lista como uma etapa combinada. Credenciais e token ficam em memória no cliente, e o código não os deve incluir em telemetria.
- O backend beta já expõe `GET /api/health` sem autenticação. A resposta informa estado/configuração do serviço, mas não testa login ou disponibilidade da ISEQ; o preflight deve tratar isto apenas como prontidão da aplicação. No backend customizado, a rota pode não existir.
- A importação envia `workers: 2`, consulta o estado a cada 2,5 segundos e busca páginas sequenciais de até 25 mil linhas, com limite total de 250 mil. O backend divide a faixa em tarefas por dia e parâmetro — cerca de nove tarefas por dia e sensor no snapshot consultado —, portanto períodos longos podem gerar muitos relatórios. A espera de cada relatório pode chegar a 15 minutos e envolver novas tentativas.
- O status do job já devolve contagens como `total_tasks`, `completed_tasks`, `cached_tasks`, `download_tasks`, `attempted_tasks` e `worker_count`; a interface hoje valida principalmente `id`, `status` e `message`. O backend também devolve a lista das tarefas em cada polling; medir tamanho/parse dessa resposta antes de propor um endpoint resumido.
- O plano do serviço Render e os tempos de uma autenticação real não foram confirmados. A documentação da execução registra uma ocasião em que o serviço respondeu com a tela “Application loading”; isso é indício de inicialização, não prova de que todo atraso atual tenha essa causa.
- Login e histórico reais continuam pendentes de validação, conforme [docs/EXECUCAO.md](EXECUCAO.md). As verificações anteriores usaram respostas controladas e dados sintéticos.

O backend do beta permite de 1 a 6 workers; a configuração do serviço indica três como padrão, a interface antiga enviava seis e o app novo envia dois explicitamente. Assim, o parâmetro explícito do cliente define este job. O backend reaproveita cobertura por sensor, parâmetro e período. Isto não prova que seis seja o melhor valor nem que o fornecedor aceite esse volume sem limitação. Ver [código do backend beta](https://github.com/edukarnopp3/edukarnopp3.github.io/blob/main/backend/app/jobs.py), [configuração do serviço](https://github.com/edukarnopp3/edukarnopp3.github.io/blob/main/render.yaml) e [seletor do beta](https://github.com/edukarnopp3/edukarnopp3.github.io/blob/main/index_completo_corrigido.html).

## Etapas de trabalho

### 1. Registrar uma linha de base sem segredos

Adicionar medição somente em memória para cada tentativa, com nome da etapa, duração, resultado genérico e contagens necessárias. Na tela, apresentar os tempos no fim da operação ou junto do estado correspondente. Não persistir esses dados em `localStorage`, pacotes `.aircase`, arquivos, analytics de terceiros ou Git.

Registrar apenas:

- duração e resultado de `health`, `login + lista de sensores` (agregado no fluxo atual), `criação do job`, `polling/execução`, `paginação/download` e `preparação local`;
- estado HTTP ou classe do erro, sem corpo bruto da resposta;
- quantidade de tarefas por estado e total de linhas recebidas, se o contrato do backend fornecer campos compatíveis;
- tamanho total aproximado transferido, se puder ser calculado sem guardar o conteúdo.

Nunca registrar usuário, e-mail, senha, cabeçalho de autorização, token, ID/MAC do sensor, leituras ambientais, URL completa com parâmetros ou corpo da resposta. A medição termina com a operação e tem botão para copiar um resumo redigido, caso o pesquisador queira compartilhar o diagnóstico.

**Critério para avançar:** cada tentativa permite dizer se o maior intervalo ocorreu antes do backend responder, durante autenticação, no trabalho ISEQ ou no download/preparo local; uma revisão do resumo confirma ausência dos dados proibidos.

### 2. Separar inicialização do backend da autenticação

Validar por consulta sem credenciais a rota pública `GET /api/health` do backend padrão. Se a resposta JSON indicar que o serviço está pronto, iniciar a chamada autenticada. Se Render devolver HTML de inicialização ou a rede falhar, repetir somente o health check com intervalo limitado e permitir cancelar; nunca mandar senha para “testar” se o serviço acordou. O health check confirma que aquela rota respondeu, não que ISEQ, credenciais ou a conexão de dados funcionarão.

No botão explícito de conectar, mostrar a etapa “Aguardando o serviço” e usar um prazo separado, inicialmente até 90 segundos, com cancelamento. Depois de pronto, iniciar uma única tentativa de login; não reenviar a senha automaticamente. O prazo atual de 45 segundos para autenticação só será alterado se a linha de base mostrar que o próprio login, já com o backend pronto, precisa de outro valor. Para um endereço de backend customizado sem `/api/health`, preservar o fluxo atual e indicar que a etapa de prontidão não está disponível.

Se a medição confirmar que o serviço dorme entre usos, comparar a espera controlada com o custo de um plano sempre ativo ou de uma hospedagem equivalente. Decidir sobre custo somente com a duração e frequência reais observadas; não adotar pings artificiais para manter o serviço acordado.

**Critério para avançar:** inicialização aparece como estado próprio, pode ser cancelada, não consome as credenciais antes do serviço estar pronto e não termina prematuramente no prazo normal de uma chamada autenticada.

### 3. Expor o progresso real do trabalho histórico

Usar e validar os campos agregados já enviados pelo backend: `completed_tasks/total_tasks`, `cached_tasks`, `download_tasks`, `attempted_tasks` e `worker_count`. Mostrar progresso concluído/total, tarefas reutilizadas do cache e tarefas novas. Não renderizar nem copiar para o diagnóstico a lista interna de tarefas, IDs de ambiente, conteúdo de erro bruto ou linhas ambientais.

Como o endpoint atual devolve a lista completa de tarefas a cada consulta de status, medir bytes e tempo de decodificação durante polling de uma faixa longa. Se isso for uma parcela relevante, planejar um contrato resumido em backend isolado, sem alterar a instância beta; até lá, limitar a UI aos campos agregados.

Manter polling, cancelamento e limite de duração existentes. O limite de 20 minutos pode encerrar a espera local enquanto o backend ainda trabalha; cancelar no navegador também não prova que o job remoto foi cancelado. Antes de sugerir cancelamento remoto, confirmar suporte explícito do backend. Até lá, comunicar o limite atual como já faz o manual, medir o estado remoto quando a sessão ainda permitir e não aumentar o limite sem revisar o ciclo de vida do job.

**Critério para avançar:** o pesquisador entende se a importação está reutilizando dados, aguardando consultas novas ou baixando linhas; erros de contrato continuam visíveis e não viram percentuais inventados.

### 4. Medir paralelismo com limite conservador

Primeiro validar os controles com backend simulado: mesmo volume de tarefas, latências e falhas determinísticas para `workers: 2` e `workers: 3`. Em seguida, se o acesso e os limites da ISEQ permitirem, comparar somente períodos curtos e ainda não cobertos pelo cache. Repetir a mesma faixa mede cache, não paralelismo; faixas diferentes também podem ter tempos upstream diferentes, então a comparação real será exploratória se não houver um backend de teste com cache isolado.

Começar comparando 2 e 3 workers. Usar 6 apenas se não houver sinais de limitação, falhas ou repetição de tentativas e se as medições indicarem benefício. Para cada configuração, registrar duração, tarefas concluídas, erros/retries e volume efetivamente obtido. Não executar carga prolongada nem varrer períodos extensos para benchmark.

Escolher o padrão pela mediana das execuções comparáveis e pela taxa de falha, não pelo menor tempo isolado. Se a amostra real for insuficiente para comparar justamente, conservar 2 como padrão e documentar a incerteza.

**Critério para avançar:** o valor escolhido reduz o tempo de trabalho não coberto sem aumentar erros/retries; o limite segue dentro do que o contrato e a ISEQ aceitam.

### 5. Investigar download e preparação local

Usar os tempos da etapa 1 para saber se as páginas sequenciais de 25 mil linhas, a resposta grande de status do job, a decodificação/preparação ou a serialização/hash no navegador são relevantes. Só então avaliar, em ordem, endpoint de status resumido (se o polling for relevante), maior página, redução de campos transferidos ou processamento fora da thread principal. Preservar validação de esquema, limite atual de 250 mil linhas, integridade dos registros e capacidade de cancelar.

Não mudar de paginação para streaming ou trazer leitura ambiental para serviço de analytics sem evidência de que o gargalo está nessa etapa e sem avaliar impacto de privacidade e memória.

**Critério para avançar:** a alteração comprovadamente reduz o tempo dessa etapa em amostras grandes, não congela a interface e mantém os mesmos registros e decisões do resultado anterior.

### 6. Publicar em etapas e documentar o resultado

Implementar primeiro as medições e estados da interface no repositório separado `qualidade-ar-pesquisa`. Atualizar manual, execução, changelog, inventário do contrato e evidências sintéticas. Manter o beta e seu serviço inalterados; qualquer mudança de backend só pode ocorrer em uma implantação isolada, com contrato e origem permitida revisados.

Antes da publicação, validar os estados com respostas simuladas: serviço pronto/lento, resposta HTML de inicialização, login lento/falho, lista vazia, job coberto por cache, job com consultas novas, erro durante polling, várias páginas e cancelamento. Depois, validar o login/histórico reais somente com autorização explícita no formulário ISEQ, sem expor credenciais em evidência. Registrar na documentação o que foi efetivamente observado, separando testes simulados dos reais.

**Critérios de conclusão:**

- causa dominante da espera identificada com tempos separados;
- caminho de conexão deixa claro se está acordando o backend, autenticando, importando ou transferindo dados;
- o diagnóstico não contém segredo, identificação ou leitura; credenciais/diagnósticos não entram em pacotes nem Git. O pacote completo da pesquisa continua preservando seus dados de origem por ação do pesquisador;
- valor de paralelismo justificado por comparação ou explicitamente mantido em 2 por falta de evidência;
- retorno de uma faixa integralmente coberta mostra `cached_tasks = total_tasks` e `download_tasks = 0` quando esses campos forem aceitos do backend;
- documentação distingue observações sintéticas e reais e registra limites ainda desconhecidos;
- beta preservado.

## Ordem recomendada

1. Instrumentação local e medidas de linha de base.
2. Verificação da rota de saúde e dos tempos de despertar, sem credenciais.
3. Estados de conexão e progresso cache/novo.
4. Comparação conservadora de 2 versus 3 workers, se segura e necessária.
5. Otimização da paginação/preparação apenas se ela aparecer como gargalo.
6. Decisão econômica sobre hospedagem sempre ativa somente após confirmar cold start.

Esta ordem evita investir em hospedagem ou paralelismo antes de saber se a espera está no backend, no login, na ISEQ ou no navegador.
