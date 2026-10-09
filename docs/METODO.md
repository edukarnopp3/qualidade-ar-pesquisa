# Método computacional descritivo-2

## Entrada e origem

Datas sem fuso usam o deslocamento UTC confirmado na importação. Datas ISO com fuso explícito o preservam. Datas de calendário inválidas são rejeitadas com linha/valor de origem. CSV é lido como texto antes da normalização, preservando decimal com vírgula e data dd/MM. Excel conserva seu sistema de datas 1900/1904 e o serial original. O importador reconhece números brasileiros/internacionais sem executar fórmulas. Valores de células e o arquivo original permanecem preservados. A validação estrutural ocorre na aba selecionada.

Uma observação tem caso, sensor, timestamp, parâmetro, valor, unidade, sourceId, linha, sinalizações e decisão. O horário não identifica sozinho um registro. Sensor original do arquivo ou consulta online deve coincidir com o caso de destino. Marca sintética encontrada na origem é conservada e impede misturar demonstração com medições reais.

Duplicatas idênticas preservam todas as entradas e usam a primeira por padrão. Duplicatas conflitantes preservam todas e ficam excluídas até revisão. Domínios físicos elementares sinalizam valores negativos de CO₂/MP e umidade fora de 0–100%; não há filtro por limites ambientais presumidos. A decisão de inclusão/exclusão é explícita e justificada. Não há imputação de lacunas.

## Cálculo e cobertura

Estatísticas das leituras: média aritmética, mediana e percentil por interpolação linear de ordem `(n−1)p`, min/max e desvio padrão populacional descritivo. Gráfico principal: média aritmética das leituras incluídas em cada hora/dia local. Não há média ponderada temporal ou inferência de exposição.

Cobertura: janela particionada em slots da frequência nominal confirmada; conta-se presença de pelo menos uma leitura utilizável por slot. Observações repetidas dentro do mesmo slot não aumentam cobertura. Frequência observada é diagnóstico independente e não substitui confirmação nominal. Janelas sem dados são criadas e ficam nulas no gráfico. Recortes parciais não recebem comparação para uma janela normativa completa.

Unidades diferentes não são misturadas na média. Unidades declaradas no contexto podem ser revisadas, com decisão registrada; valores originais e unidades explícitas de arquivo não são convertidos silenciosamente.

## Referência e resultado

Elegibilidade e resultado são eixos diferentes. A referência declara parâmetro/unidade, ambiente, janela, threshold, cobertura mínima, fonte/versão e requisitos de medição confirmados. A comparação fica impedida se qualquer condição falhar. CO₂ externo, quando exigido, pertence ao contexto do caso: valor finito e não negativo, unidade ppm/ppb/% e fonte/período documentados. As conversões entre essas unidades são explícitas antes da diferença; zero é admissível e não significa ausência. Contexto legado sem unidade é identificado como ppm declarado na versão anterior. Critério sintético não pode ser aplicado a dados reais.

Acima/até a referência usa a média da janela elegível (ou diferença com CO₂ externo quando declarada). A proporção acima usa somente as janelas elegíveis como denominador. O sistema não certifica conformidade ou risco sanitário. Fonte documental e critérios científicos exigem revisão do pesquisador/orientador.

## Limitações desta implementação

Cada execução nova congela identificação, fuso, frequência, unidades, contexto externo, fontes, observações e decisões da revisão usada no cálculo. Alterações e recortes criam outra execução; falha do cálculo preserva o estado anterior. No pacote, só a execução selecionada leva a base completa; o restante do histórico leva resultados e metadados expressamente sem entradas. Legados sem snapshot conservam números, com aviso de que a reprodução histórica exata não é demonstrável.

As estatísticas usam operações estáveis para evitar overflow em entradas finitas extremas. Um histograma de série constante contém uma faixa única com limites iguais e contagem conservada. Isso não declara valores extremos ambientalmente plausíveis nem dispensa controle de qualidade do instrumento.

Média simples em amostragem irregular; frequência nominal constante por caso; deslocamento UTC explícito, sem reconstrução histórica automática de horário de verão; critérios mínimos de observações/janelas precisam ser revisados com as fontes; limite de 250 mil linhas por aba, 50 MB por arquivo e um milhão de observações por caso; até 20 mil janelas por execução. Relatório PDF mostra até 500 janelas, indicando a limitação; Excel/CSV preservam todas.

Não confundir testes numéricos com validação metrológica. A revisão final deve analisar sensibilidade às políticas de qualidade e agregação e confrontar gabarito produzido independentemente.
