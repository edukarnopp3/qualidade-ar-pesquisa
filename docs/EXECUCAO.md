# Execução — registros de 08 e 09/10/2026

## Decisões aprovadas

App por link; análise histórica local; escola/hospital em casos independentes; Excel e histórico ISEQ como entradas; painel, PDF, tabela e pacotes reabríveis; sistema visual vigente do Nexo e cores próprias para séries; documentação integrada à entrega.

## Implementado em 0.1.0

Núcleo modular autoral em JavaScript, Vite para empacotar arquivos estáticos, Web Workers para leitura/normalização/análise, SheetJS local para Excel, ECharts local para gráficos, jsPDF para relatório, JSZip para pacote. Nenhuma função analítica depende do backend. A consulta ISEQ é opcional e explicitamente iniciada pelo usuário.

A tela inicial abre vazia. O exemplo gera sete dias sintéticos em dois casos, sem misturar sensores. Importação permite conferir metadados. Qualidade permite revisar conflitos e registrar motivo. Referências são regras versionadas da sessão; o aplicativo preserva a versão em cada execução e não presume conformidade. Pacotes arquivados exibem resultados preservados até reprocessamento explícito.

## Verificações realizadas

- 24 testes automatizados de cálculo, importação, referências, pacotes, exportação e contrato ISEQ, com dados controlados; zero falhas na execução registrada.
- Build de produção concluído. Bibliotecas maiores são carregadas por função; a entrada inicial tem aproximadamente 64 kB de JavaScript antes de compressão.
- Interface no navegador: importação de Excel sintético; confirmação de sensor/unidades/fuso; qualidade com conflitos; média diária/horária; referência didática; decisão manual; PDF; download e reabertura de pacote sem recalcular; tema claro/escuro; 390 px sem transbordamento horizontal; logs de erro vazios nos fluxos inspecionados.
- PDF gerado pela interface renderizado com Poppler e inspecionado. O aviso local de fonte Symbol não produziu defeito visível na página conferida.

Evidências em `docs/evidencias/`. Elas usam somente dados sintéticos.

## Publicação confirmada

- Repositório separado: https://github.com/edukarnopp3/qualidade-ar-pesquisa
- Aplicação: https://edukarnopp3.github.io/qualidade-ar-pesquisa/
- Código conferido: `b3e174a822a6aaeea7822e5babf6a881b62e0a6f`.
- Workflow de publicação concluído com sucesso: https://github.com/edukarnopp3/qualidade-ar-pesquisa/actions/runs/37836133745
- Em 08/10/2026, a página pública abriu a tela inicial e executou a demonstração com Web Worker e gráficos. Foram conferidos o caso escolar com sete médias diárias e o hospitalar com PM2,5; três gráficos renderizados, sem erros de console nos fluxos observados e sem transbordamento horizontal na largura de desktop inspecionada. O formulário opcional ISEQ identifica o backend e pede autorização antes de autenticar.
- `docs/evidencias/publicado-painel.jpg` registra a página pública com dados sintéticos. A publicação contém código, documentação e exemplos sintéticos; nenhuma leitura institucional ou credencial foi publicada.

A publicação funcional não resolve as pendências de acesso real à ISEQ, validação metrológica, referências aplicáveis ou avaliação acadêmica listadas abaixo.

## Correção 0.1.1 — contexto do fetch

Eduardo reportou `Failed to execute 'fetch' on 'Window': Illegal invocation` ao iniciar o login ISEQ. O conector guardava a função nativa em uma propriedade e a chamava como método da instância `IseqClient`; o navegador recebia um contexto inválido. O `fetch` é agora vinculado ao contexto global antes de ser armazenado. A correção mantém o contrato de URLs, autenticação e aquisição histórica.

Esta falha era anterior a qualquer resposta do backend e não demonstra erro na senha. A autenticação real e a obtenção de históricos continuam dependendo da disponibilidade do serviço e da conta do pesquisador.

- Build local de produção concluído após a correção.
- Código corrigido: `1c08f190cccc95bdd26b0d624d661ca11408ab48`.
- Workflow de publicação concluído com sucesso: https://github.com/edukarnopp3/qualidade-ar-pesquisa/actions/runs/37838187060
- Página pública conferida em `https://edukarnopp3.github.io/qualidade-ar-pesquisa/?v=0.1.1`, exibindo a versão 0.1.1. Evidência sem credenciais em `docs/evidencias/versao-0.1.1.jpg`.
- Uma consulta HTTP ao backend expirou em 20 segundos. No navegador, `/api/health` mostrou a página do Render “Application loading”, com indicação de inicialização do serviço, em vez de uma resposta JSON da aplicação. Essa observação é separada da falha corrigida de contexto do fetch.

Nenhuma credencial real foi enviada durante esta correção. A publicação da 0.1.1 foi confirmada naquele momento; o login real e o download autenticado de histórico ainda não foram validados. A versão seguinte está registrada abaixo.

## Pendências científicas e operacionais

### Auditoria multiagente concluída em 08/10/2026

No código `29ed8aaf6eba5cdcb9ee8867b7b82f1abcb272f0` (0.1.1), três agentes e a revisão de navegador confirmaram **26 famílias de falhas: 8 P1, 15 P2 e 3 P3**. O login com servidor controlado permaneceu bloqueado por 75 segundos, sem prazo, progresso ou cancelamento. A autenticação/histórico rápidos funcionaram no controle sintético; login real e disponibilidade/CORS de produção continuam não validados.

Os 24 testes existentes passaram. A ampliação de cobertura encontrou defeitos que esses testes não exercitavam, incluindo CSV, calendário Excel, identidade e natureza da origem, contexto externo/histórico, esquema/sanitização de pacotes e estados de interface. Nenhuma correção do código de produção foi aplicada **naquela entrega de auditoria**. [Relatório completo](../audits/2026-10-08/RELATORIO.md), [relatórios por área e reproduções](../audits/2026-10-08/REPRODUCAO.md). As correções posteriores estão registradas na seção 0.1.2.

1. Obter a primeira consulta histórica real na ISEQ, com autenticação da conta do pesquisador. Nenhuma credencial foi solicitada em chat nem incorporada ao código.
2. Confirmar fabricante/modelo, unidades reais, princípio de medição, frequência nominal e metadados de cada ambiente. COVs/NOx continuam descritivos quando unidade/validade não foram confirmadas.
3. Revisar fontes e edições, método, janelas, critérios de suficiência e requisitos externos. As regras cadastradas são declaradas pelo pesquisador; o software não verifica automaticamente a validade documental.
4. Medir capacidade com períodos reais e realizar revisão visual/a11y completa em estados adicionais. Os limites atuais são proteções de tamanho, sem garantia de desempenho em qualquer dispositivo.
5. Elaborar gabarito independente, separar desenvolvimento/avaliação, congelar protocolo e comparar com o Excel real.
6. Confirmar enquadramento/orientação/autorizações institucionais e licença autoral do software.

## Escopo que permanece posterior

Tempo real, alertas, previsão, controle de ventilação, contas do software, nuvem/collaboração e certificação automática. A conexão histórica ISEQ não constitui monitoramento contínuo.

## Correção 0.1.2 — 09/10/2026

Após autorização de Eduardo, os 26 achados foram corrigidos com agentes especializados e integração/revisão de navegador. [Matriz de fechamento, evidências e limites](CORRECOES-0.1.2.md). Método passou a `descritivo-2` por correções de entrada e contexto.

O navegador confirmou recuperação após timeout de45 s/cancelamento, fechamento e resposta tardia, conta vazia, erro 500, sessão 401 e logout remoto pendente; CSV com dd/MM e decimal brasileiro; bloqueios de sensor/natureza divergentes; contexto externo independente de regras/casos; snapshot histórico e exportações; reabertura completa/compartilhável; nova execução explícita; rótulo em 390 px. Todos os dados/credenciais desses controles eram fictícios.

O PDF de uma única média 600 foi renderizado com Poppler e o ponto está visível. Excel e pacotes baixados no navegador foram confrontados programaticamente: frequência 86400 s e contexto original preservados após uma alteração posterior. A revisão cruzada acrescentou correções de série constante, tolerância decimal, distribuição e fuso do pacote e troca de caso transacional. As contagens finais de testes/build/publicação acompanham o registro de fechamento.

Rodada final local: **97/97 testes aprovados**, zero falhas, build concluído (806 módulos). Os callbacks reais da interface têm 11 regressões de troca transacional e leitura/abertura concorrente. Evidência integral em [testes-finais.txt](evidencias/v0.1.2/testes-finais.txt).

As pendências científicas e o login real da ISEQ permanecem as listadas acima. A correção do cliente não muda disponibilidade/autenticação do backend externo.
