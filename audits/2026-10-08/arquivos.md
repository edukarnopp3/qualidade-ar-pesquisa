# Auditoria de importação, pacotes e exportação

Data: 08/10/2026. Código conferido: `29ed8aaf6eba5cdcb9ee8867b7b82f1abcb272f0`, software 0.1.1.

Auditoria somente de leitura dos módulos de produção. Foram criados e executados scripts e arquivos sintéticos dentro de `audits/2026-10-08/arquivos/`. Nenhuma credencial, leitura institucional, alteração de produção, commit ou publicação integra esta auditoria.

## Resultado

Oito famílias de defeitos foram confirmadas por reproduções locais. A corrupção silenciosa de datas/números no CSV e a exportação com contexto diferente do contexto da execução afetam o uso científico. A lista não equivale a demonstrar ausência de outros defeitos.

| ID | Prioridade | Defeito confirmado | Código principal |
|---|---|---|---|
| ARQ-01 | P1 | CSV altera decimal com vírgula e datas brasileiras antes da normalização | `src/importer.js:8` |
| ARQ-02 | P2 | Calendário Excel 1904 ignorado | `src/importer.js:8`, `src/core.js:33` |
| ARQ-03 | P1 | Exportação de execução histórica usa contexto/decisões atuais | `src/exports.js:20`, `src/exports.js:22`, `src/main.js:30` |
| ARQ-04 | P2 | Compartilhável preserva decisões que podem conter leituras individuais | `src/packages.js:17` |
| ARQ-05 | P2 | Esquema do pacote não valida tipos nem vínculo entre caso, sensor e execução | `src/packages.js:50` |
| ARQ-06 | P2 | Programa cria pacote com 148 fontes que ele próprio não reabre | `src/packages.js:19`, `src/packages.js:35` |
| ARQ-07 | P2 | Validação antes da escolha de aba bloqueia planilha válida por outra aba | `src/importer.js:16`, `src/importer.js:19`, `src/importer.js:20` |
| ARQ-08 | P2 | PDF omite pontos isolados, incluindo análise de uma janela | `src/exports.js:48` |

P1: corrigir antes de usar o resultado como evidência da pesquisa. P2: corrigir para assegurar os fluxos de importação, apresentação e preservação prometidos. Esta classificação não considera como defeito a falta de assinatura digital, que já está documentada.

## Reproduzir

Na raiz do repositório, com dependências existentes:

```powershell
node audits/2026-10-08/arquivos/reproduzir.mjs
node audits/2026-10-08/arquivos/verificar-contratos.mjs
```

Os scripts gravam entradas, saídas e evidências JSON. O segundo contém asserções e falha se a evidência esperada não se reproduzir. Todos os arquivos de entrada são sintéticos.

### ARQ-01 — corrupção silenciosa de CSV

**Confirmação:** importação real por `readInput`, seguida de `normalizeRows`.

- Arquivo `csv-decimal-comma.csv`: `2026-10-01 00:00;"600,5"` e `2026-10-01 00:01;"700,5"`.
- Gabarito: 600,5 e 700,5; média 650,5.
- Obtido: 6005 e 7005, sem rejeição; a média seria 6505.
- Arquivo `csv-data-br.csv`: `01/10/2026 00:00;600` e `02/10/2026 00:00;700`.
- Gabarito: 1 e 2 de outubro de 2026, conforme o formato dd/MM que o normalizador aceita.
- Obtido: 10 de janeiro e 10 de fevereiro de 2026, sem rejeição.

O `read(bytes, {type:'array',cellDates:false})` interpreta o CSV antes do normalizador: muda textos para números/seriais. Assim, `numeric` e `parseTimestamp` recebem valores já alterados. A prévia também já contém os valores alterados. O original ainda existe nos bytes preservados, mas `originalTime` da observação já vira o serial interpretado.

**Impacto:** gráfico, recorte temporal, cobertura e comparação podem ficar incorretos sem uma indicação de erro. Ter testes unitários de `numeric('600,5')` não cobre este caminho completo.

**Correção recomendada:** tratar a entrada CSV preservando os textos antes da interpretação de localidade; confirmar delimitador e formato de data quando necessário. Acrescentar testes do arquivo até a análise, com o gabarito acima.

Evidência: `arquivos/evidencias.json`, IDs `csv-decimal-comma.csv` e `csv-data-br.csv`.

### ARQ-02 — Excel com sistema de datas 1904

**Confirmação:** `excel-1904-sintetico.xlsx`, workbook com `WBProps.date1904=true`, serial 44834, formato de data explícito.

- Gabarito: 01/10/2026 00:00. Conferência independente: dias decorridos desde 01/01/1904; a biblioteca `SSF.parse_date_code(44834,{date1904:true})` também retorna essa data.
- Obtido: 30/09/2022 00:00, diferença de 1462 dias, sem rejeição.

O importador descarta o indicador 1904. `parseTimestamp` usa sempre a origem numérica do sistema 1900 (`25569`).

**Impacto:** históricos de workbooks configurados para 1904 entram em anos errados. Ajustar o fuso não corrige esse erro.

**Correção recomendada:** preservar o sistema do workbook e converter suas células de data com o calendário apropriado, mantendo serial, formato e origem no registro.

Evidência: `arquivos/evidencias.json`, ID `excel1904`.

### ARQ-03 — exportação de histórico com metadados atuais

**Confirmação:** execução de duas leituras (500 e 700) com frequência nominal de 60 s; depois o caso é modificado para 300 s e unidade não confirmada, e a execução antiga é exportada.

- Gabarito da execução antiga: média 600; 2 slots ocupados; 60 esperados; cobertura 2/60 = 3,3333%; método com frequência de 60 s.
- Obtido: aba `Resultados` conserva 60 slots e 3,3333%, mas aba `Metodo` registra frequência de 300 s.

`state.run` armazena resultados, IDs, nome e offset, mas não uma cópia completa do contexto nem das decisões/fontes usadas. O Excel usa `dataset` atual em `Qualidade`, `Decisoes`, `Metodo` e `Arquivos`; o PDF usa nome, sensor, origem e offset atuais. O pacote também combina o `dataset` atual com a execução escolhida. O ramo visual/exportação histórica é auditado adicionalmente pelo agente principal e deve ser consolidado como um achado único.

**Impacto:** o mesmo ID de execução pode produzir relatórios com metadados distintos. O pacote completo da execução antiga pode recalcular com decisões/contexto diferentes dos que produziram o resultado arquivado.

**Correção recomendada:** arquivar contexto, decisões, fontes e versão do método por execução; todas as saídas devem consultar essa cópia. Ao empacotar uma execução antiga, preservar as entradas/decisões correspondentes ou declarar expressamente que apenas seu resultado é histórico.

Evidências: `arquivos/evidencias.json`, ID `export-historical-metadata`; `arquivos/execucao-historica-metadados-atuais.xlsx`.

### ARQ-04 — compartilhável deixa decisões individuais

**Confirmação:** decisão sintética contendo `observationId` e motivo `Escolhi a leitura 500 ppm; a original 700 ppm é conflito.`. Exportar compartilhável e reabrir.

- Observações individuais: zero, como esperado.
- Arquivos originais: ausentes, como esperado.
- `dataset.decisions`: ainda contém o identificador de uma observação e o motivo com leituras individuais.

O espalhamento `{...dataset}` preserva `decisions`; a sanitização só troca `observations`, `issues`, `sources.bytes` e `hasInputs`. O comportamento contradiz a descrição da interface de que o compartilhável exclui leituras individuais quando elas foram escritas no motivo da revisão. Metadados gerais identificáveis, que a documentação manda revisar, são uma questão distinta.

**Impacto:** quem recebe o ZIP pode extrair decisões e valores individuais não visíveis na interface reaberta. Não foi encontrada credencial ou token nos pacotes controlados.

**Correção recomendada:** remover decisões por observação do compartilhável ou criar uma revisão explícita dos campos incluídos, com resumo agregado de tratamento sem texto individual por padrão.

Evidências: `arquivos/evidencias.json`, ID `shared-decisions`; `arquivos/sintetico-compartilhavel.aircase`.

### ARQ-05 — validação incompleta do esquema do pacote

Duas reproduções confirmadas com JSON e hashes consistentes:

1. Caso com `id=another-case` e `sensorId=another-sensor`, execução com `datasetId=synthetic-case` e `sensorId=AUDIT-SYNTHETIC`: `openPackage` aceita. Ele deveria rejeitar a incompatibilidade entre a identificação do caso e a execução que aparece como seu resultado.
2. `run.analysis.bins={not:'an array'}`: `openPackage` aceita; `exportCsv` falha com `run.analysis.bins.map is not a function`.

O código verifica somente a presença de `bins` e algumas listas; não seu tipo, os campos internos, enums ou vínculos. Isso permite que conteúdo inconsistente avance até os componentes da interface/exportação.

**Impacto:** um pacote com estrutura inválida pode ser tratado como conferido e então quebrar o fluxo; um pacote com IDs divergentes pode associar resultado e identificação incorretamente.

**Distinção:** recalcular hashes após alterar componentes não demonstra quebra da integridade criptográfica. O manifesto não tem assinatura, como documentado. O defeito aqui é aceitar um esquema contraditório mesmo depois de a verificação de hashes terminar corretamente.

**Correção recomendada:** validar esquema, tipos, datas/números finitos, parâmetros, limites de listas e igualdade de IDs antes de substituir o estado atual; validar também cada execução do histórico.

Evidências: `arquivos/evidencias.json`, ID `package-inconsistent-schema`; `arquivos/contratos-evidencias.json`, ID `schema-bins-invalid`; pacotes `sintetico-inconsistente.aircase` e `sintetico-bins-invalidos.aircase`.

### ARQ-06 — pacote produzido não pode ser reaberto

**Confirmação:** 148 fontes sintéticas pequenas, cada uma com bytes/hash próprios, mais `case.json`, `execution.json` e `history.json`.

- `createPackage`: sucesso; pacote com cerca de 39 kB.
- `openPackage`: rejeição `O pacote contém arquivos demais.` porque há 151 componentes no manifesto, acima do limite 150.

O importador não estabelece um limite de fontes compatível e o exportador não aplica a mesma restrição antes de gerar a saída. O problema está no contrato entre os dois lados; não depende do tamanho de 80 MB nem da descompactação de 160 MB.

**Impacto:** um estudo com muitas exportações pequenas pode aparentemente ser salvo, mas não recuperado pelo próprio programa. O arquivo ainda preserva os bytes; esta evidência não demonstra perda física do ZIP.

**Correção recomendada:** alinhar limites de geração e leitura e avisar antes de salvar; testar a ida e volta no limite exato.

Evidências: `arquivos/contratos-evidencias.json`, ID `own-package-too-many-sources`; `arquivos/sintetico-148-fontes.aircase`.

### ARQ-07 — escolha de aba bloqueada antes do formulário

Duas planilhas sintéticas demonstram a mesma família:

1. `Dados brutos` contém só cabeçalhos; `Historico` tem uma linha válida. O importador prefere a primeira e rejeita todo o arquivo com `A planilha selecionada não contém linhas de dados.`. O pesquisador não consegue escolher a aba válida.
2. `Dados brutos` contém uma leitura válida de um sensor; `Resumo todos sensores` contém dois sensores. A checagem aplicada a todas as abas rejeita a segunda, bloqueando o acesso à primeira antes da escolha.

**Impacto:** o fluxo prometido de escolher a aba não funciona nesses arquivos, exigindo edição externa. Evitar misturar sensores continua correto; a validação deve incidir sobre a aba escolhida para a importação.

**Correção recomendada:** montar o inventário das abas com status/avisos, selecionar uma aba utilizável e validar a aba escolhida na confirmação. Informar erros das demais sem bloquear automaticamente a seleção válida.

Evidências: `arquivos/contratos-evidencias.json`, IDs `empty-preferred-sheet-blocks-valid-sheet` e `unselected-mixed-sheet-blocks-valid-sheet`; planilhas `sintetico-aba-vazia-com-historico.xlsx` e `sintetico-aba-escola-com-resumo.xlsx`.

### ARQ-08 — PDF sem ponto quando há uma janela ou leituras isoladas

**Confirmação:** duas leituras 500 e 700 dentro de uma única janela de uma hora; a média por janela é 600. O PDF é válido e a tabela contém 600, mas o gráfico fica somente com eixos, sem linha nem ponto.

O desenho só cria um segmento quando tanto a janela atual como a anterior têm média. Não desenha marcadores para janelas que não pertencem a um segmento. Portanto, janelas isoladas por lacunas também desaparecem do gráfico.

**Impacto:** apresentação visual pode sugerir ausência de resultado onde existe uma média válida, embora tabela e resumo continuem corretos.

**Correção recomendada:** desenhar marcadores de valores válidos, inclusive isolados, sem ligar através de lacunas. Tratar a escala constante para não escrever dois limites idênticos nos eixos.

Evidências: `arquivos/gabarito-600.pdf`, `arquivos/gabarito-600-page-1.png`; renderização Poppler da página 1 inspecionada. O aviso de fonte Symbol do renderizador não causou defeito visível no texto inspecionado.

## Controles que passaram

O gabarito usa aritmética independente: duas leituras 500 e 700; média/mediana 600; p95 por interpolação linear 690; N=2; uma hora com frequência de 60 s tem 60 slots esperados e 2 ocupados, cobertura 2/60.

| Controle | Resultado observado | Evidência |
|---|---|---|
| Completo normal | Reabre execução exatamente; duas observações e bytes originais com hash idêntico | `contratos-evidencias.json: full-shared-normal` |
| Compartilhável normal | Reabre a execução; zero observações; sem bytes; `hasInputs=false` | mesma evidência; a ressalva ARQ-04 permanece |
| Componente alterado sem atualizar manifesto | Rejeição por integridade divergente | `tamper-rejection` |
| Versão de esquema 2 | Rejeição por incompatibilidade | `schema-version-rejection` |
| Descompactação acima do limite controlado | Interrompida com erro antes de unir o conteúdo | `bounded-uncompression` |
| CSV ISO com ponto decimal | 600.5/700.5 e datas corretas no fluxo observado | `evidencias.json: csv-iso-date.csv` |
| Fórmula textual de CSV | `=600+1` rejeitado e mantido no registro de problema | `evidencias.json: csv-formula.csv` |
| Excel e CSV da execução de controle | Média, N, slots e cobertura concordam com gabarito | `contratos-evidencias.json: exports-independent-oracle` |
| PDF da execução de controle | Resumo mostra 2, 600, 690 e 3,33%; ID da execução preservado; duas páginas válidas | `pdf-evidencias.json`, `gabarito-600-pdf.txt` |
| Neutralização de fórmula na exportação | String `=HYPERLINK(...)` recebe apóstrofo; valor numérico negativo permanece número | asserções de `verificar-contratos.mjs` |

Os números do PDF foram conferidos por extração com pypdf e a primeira página foi renderizada/inspecionada. A concordância numérica não elimina ARQ-03 nem ARQ-08.

## Cobertura e limites

- Cobertos: entrada XLSX/CSV até normalização; calendário 1904; seleção de abas; originais e hashes; normal/compartilhável; esquema e vínculo; geração/leitura com quantidade de fontes; limite de descompactação; saídas PDF/Excel/CSV com gabarito controlado; exportação de uma execução antiga depois de alterar contexto.
- Não realizados neste ramo: navegador compartilhado, login real ISEQ, dados físicos de escola/hospital, avaliação normativa, calibração, arquivos reais corrompidos de diversos fornecedores, XLS legado binário, desempenho no limite de 1 milhão de observações, 50/80/160 MB reais ou entrada hostil exaustiva. A auditoria do navegador e os demais módulos pertencem a outros agentes.
- O limite de 250 mil linhas do importador é checado depois de a biblioteca ler o arquivo e montar a tabela. Essa ordem foi identificada na leitura; não foi executado um teste de esgotamento de memória e, por isso, não há confirmação de travamento por esse motivo neste relatório.
- Os testes existentes cobriam números brasileiros já como string no XLSX e rejeição de hashes alterados, mas não o pré-processamento CSV, o calendário 1904, o vínculo/tipos do pacote ou a exportação do histórico com contexto modificado. São regressões a acrescentar após corrigir.

## Sequência sugerida de correção

1. CSV e calendário Excel, com testes do arquivo até o resultado final.
2. Cópia imutável por execução e alinhamento de todas as saídas ao mesmo contexto histórico.
3. Validar pacotes antes de alterar estado; alinhar limites de salvar/reabrir; revisar o conteúdo compartilhável.
4. Recuperar escolha de aba e desenhar valores isolados no PDF.
5. Reexecutar cada reprodução com resultado esperado corrigido e registrar a versão de publicação; a auditoria atual não implementou essas correções.
