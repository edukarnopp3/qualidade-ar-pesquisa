# Correções da auditoria — versão 0.1.2

**Concluídas em 09/10/2026, America/Sao_Paulo.** Referência: [auditoria de 08/10/2026, versão 0.1.1](../audits/2026-10-08/RELATORIO.md), código `29ed8aaf6eba5cdcb9ee8867b7b82f1abcb272f0`. Esta entrega implementa as correções dos **26 achados**. Método computacional: `descritivo-2`.

Três frentes de agentes corrigiram conexão, núcleo/importação e pacotes/exportação. O coordenador integrou a interface e conferiu os fluxos no navegador. Uma revisão cruzada adicional corrigiu arredondamento decimal, série constante e estado após falha de troca de caso. As reproduções antigas foram preservadas como registro histórico; as regressões abaixo exigem o comportamento corrigido.

## Matriz de fechamento

Todos os IDs desta tabela têm correção implementada. “Navegador” descreve os controles sintéticos exercitados; não significa autenticação na conta real da ISEQ.

| ID | Correção | Evidência de regressão |
|---|---|---|
| ISEQ-01 | Prazo de 45 s inclui requisição e corpo, progresso/tempo, cancelamento, recuperação do botão | `iseq-regression.test.js`; timeout real de 45 s e cancelamento no navegador |
| ISEQ-02 | Prazo integral de 20 min cobre criação, polling, corpo e todas as páginas | Testes de transporte pendente e expiração na segunda página |
| ISEQ-03 | Preserva código/status/mensagem do `detail` e distingue erro de rede | Testes; erro 500 estruturado apresentado no navegador |
| ISEQ-04 | HTML, JSON e envelopes/esquemas inválidos são recusados | Testes de sessão, sensores, status e página |
| ISEQ-05 | Fechar aborta; respostas tardias não registram sessão nem substituem outro modal | Testes de abort/invalidação; cadastro aberto preservado após login lento |
| ISEQ-06 | 401 invalida sessão e interface retorna ao login | Teste de 401 e proteção de sessão posterior; navegador com histórico 401 |
| ISEQ-07 | Logout local imediato; revogação remota limitada a 8 s | Testes; novo login disponível em 559 ms com logout remoto pendente |
| ISEQ-08 | `finally` limpa progresso/timer/listener/controlador depois de falha ou abort | Testes de corpo pendente; erro 500/cancelamento sem spinner residual |
| ISEQ-09 | Lista vazia tem mensagem e ações Atualizar sensores/Sair | Testes; navegador com lista vazia |
| ISEQ-10 | Polling remove listeners temporários ao concluir ou abortar | Teste instrumentado de listeners |
| ARQ-01 | CSV conserva texto, decimal com vírgula e dd/MM antes de normalizar | `science-import-regression.test.js`; navegador600,5/700,5 → média 650,5, dias 1–2/10 |
| ARQ-02 | Excel conserva calendário 1900/1904, serial e fração de hora | Gabaritos de datas e UTC-3 |
| ARQ-03 | Cada revisão congela contexto/fontes/leituras/decisões; telas e saídas usam a execução selecionada | `executions-ui-regression.test.js`, `packages-export-regression.test.js`; navegador e Excel/pacote com frequência antiga 86400 s |
| ARQ-04 | Listas de campos removem decisões, ocorrências, notas, mapeamento/contexto privado em todas as camadas compartilháveis | Testes com texto sentinela no caso/snapshot/histórico; compartilhável reaberto sem base individual |
| ARQ-05 | Tipos, números, IDs, fontes e vínculos validados antes de renderizar; tolerância decimal controlada e distribuição/offset conferidos | Pacotes adulterados com hashes recalculados recusados; séries constantes/decimais válidas reabrem |
| ARQ-06 | Geração e abertura usam o mesmo contrato de limites | Ida e volta de 148 e 1.000 fontes; tamanho/hash e excesso recusados |
| ARQ-07 | Estrutura validada somente na aba escolhida; erros de outras abas ficam inventariados | Aba válida com resumo vazio/misto, cabeçalho duplicado, todas inválidas |
| ARQ-08 | PDF desenha marcadores e escala não degenerada; lacunas não são ligadas | Teste de geometria; PDF de uma média 600 renderizado e inspecionado |
| CALC-01 | Converte ppm/ppb/% externo antes da diferença | Gabarito 200.000 ppb e conversões em três unidades |
| CALC-02 | Exige valor externo finito, não negativo, unidade e origem; zero é válido | Testes de domínio/origem e formulário independente |
| CALC-03 | Confronta ID original do arquivo/ISEQ com caso e bloqueia divergência antes de incorporar | Testes de normalização/análise; importação Hospital em Escola bloqueada no navegador |
| CALC-04 | Marca sintética original permanece; destino deve ter mesma natureza | Teste de natureza; Excel sintético em caso importado bloqueado |
| CALC-05 | CO₂ externo pertence ao caso/revisão, separado do catálogo de regras | Teste de contexto; regra B e alternância de casos preservam resultado de A |
| CALC-06 | Estatísticas, quantis, perfil/histograma usam operações estáveis para entradas finitas extremas | Gabaritos ±1e308, séries constantes e contagens |
| UI-01 | Edita/revisa/importa/troca caso em candidato e só confirma após cálculo válido; compartilhável recusa antes da alteração | Testes de rollback e `case-switch-regression.test.js` com a função real; edição compartilhável desabilitada no navegador |
| UI-02 | Abrir análise recebe `aria-label` persistente | 390 px: um botão acessível pelo nome, habilitado, sem overflow horizontal no estado conferido |

Arquivos de teste estão em [tests/](../tests/). Os controles utilizam exclusivamente dados e credenciais fictícios.

## Evidências conferidas

**Rodada final:** `npm test` **97/97 aprovados**, zero falhas/cancelamentos/ignorados; `npm run build` concluído, 806 módulos. O registro completo está em [testes-finais.txt](evidencias/v0.1.2/testes-finais.txt). Build mantém carregamento sob demanda de bibliotecas; gráficos/exportações geram chunks maiores que500 kB, sem erro de compilação. Isso permanece sujeito à avaliação de desempenho com históricos reais.

- [Timeout tratado e botão recuperado](evidencias/v0.1.2/timeout-tratado.jpg).
- [Resposta tardia não substitui outro formulário](evidencias/v0.1.2/resposta-tardia-ignorada.jpg).
- [CSV brasileiro normalizado corretamente](evidencias/v0.1.2/csv-br-correto.jpg).
- [Contexto da execução anterior preservado](evidencias/v0.1.2/historico-contexto-preservado.jpg).
- [Contexto externo preservado](evidencias/v0.1.2/contexto-externo-preservado.jpg).
- [Compartilhável com edição da base desabilitada](evidencias/v0.1.2/compartilhavel-bloqueado.jpg).
- [Rótulo móvel](evidencias/v0.1.2/mobile-label.jpg).
- [PDF com uma média 600 visível](evidencias/v0.1.2/media-isolada-600.png).

O pacote completo baixado no navegador foi reaberto sem recalcular: ID `b5c53e40-0ade-424c-8931-b91d3c470546`, nome original “CONTROLE FICTÍCIO · CSV brasileiro”, frequência 86400 s, duas observações, média 650,5. A planilha baixada conservou a mesma frequência e sensor `AUDIT-SCHOOL`. O compartilhável preservou o ID/resultados e retirou observações/decisões. Recalcular no navegador criou outro ID `28ed96fc…` com método 2. Os nomes dos arquivos de exportação também usam o nome da execução selecionada.

## Preservação e compatibilidade

Regressões adicionais de interface executam os callbacks reais de `main.js` em VM com transporte/worker controlados: quatro cenários de troca de caso e sete de leitura/abertura concorrente. Cálculo recusado preserva caso/configuração/execução; resposta de arquivo ou pacote invalidada por outra operação ou formulário é descartada antes de alterar estado. Erros antigos não substituem feedback de uma operação posterior.

Pacote completo conserva a base exata da execução selecionada; os demais itens de histórico são resultados agregados expressamente sem entradas. Isso evita duplicar uma base bruta para cada recorte. Conserve pacotes completos separados para bases diferentes. Execuções antigas sem snapshot são identificadas como legadas e não recebem promessa de reprodução histórica exata.

Compartilhável remove contexto individual, mas ainda contém identificação e agregados: revise antes de compartilhar. Hashes demonstram integridade relativa ao manifesto, sem assinatura/autenticidade. Limites de arquivo não são garantia de desempenho em qualquer dispositivo.

## Publicação conferida

- Código corrigido: `da665e8ddc65c87b34f8b06b07739d06b8c5f664`.
- [Workflow de testes, build e publicação concluído com sucesso](https://github.com/edukarnopp3/qualidade-ar-pesquisa/actions/runs/37942358949).
- [Página pública](https://edukarnopp3.github.io/qualidade-ar-pesquisa/?v=0.1.2), conferida em 09/10/2026: versão 0.1.2, demonstração calculada por worker, três gráficos renderizados, método `descritivo-2`, sem erro de console ou overflow horizontal no estado desktop observado.
- [Captura da versão publicada](evidencias/v0.1.2/publicado-painel.jpg).

## Limites da conclusão

Os 26 comportamentos reproduzidos foram corrigidos no escopo auditado; isso não demonstra ausência de todo bug possível. Login e download reais da ISEQ, disponibilidade/CORS do serviço, calibração, fontes normativas e análise de dados institucionais **ainda não foram validados**. O backend externo não foi alterado. Nenhuma senha real foi solicitada, gravada ou publicada.

Para o piloto de mestrado permanecem as etapas de documentação do instrumento, gabarito independente com dados reais, revisão de referências/protocolo e avaliação com usuários. A aprovação dos testes de software não equivale a validação metrológica ou conclusão acadêmica.
