# Gráficos com extremos e distribuição por dia da semana

## Referência e escopo

Adaptação solicitada por Eduardo em 27/10/2026, usando como referência visual as figuras 04 a 11 do arquivo Word **tcc_final_atualizado (Reparado).docx**, indicado pelo pesquisador e lido localmente. Essa versão substituiu o PDF anteriormente consultado como referência desta entrega. O original não foi alterado. Documento, imagens e medições reais do TCC não foram incorporados ao repositório.

Foi adotada a estrutura de série temporal, perfil diurno e comparação por dia da semana. Fonte, cores por parâmetro, temas e componentes permanecem baseados nos tokens Nexo aprovados. O histograma existente continua disponível como complemento. Valores e referências desenhados nas figuras do TCC não são transferidos como padrões normativos do aplicativo.

## Série temporal e perfil diurno

- A linha temporal mantém a média aritmética por hora/dia local. A faixa sombreada liga o mínimo ao máximo das leituras incluídas em cada janela. Lacunas interrompem linha e faixa; uma janela isolada mostra o intervalo vertical e o ponto correspondente à média. A geometria da faixa usa os extremos diretamente, inclusive para temperaturas negativas, sem empilhamento a partir de zero.
- O perfil de 24 horas reúne todas as leituras aceitas da mesma hora local nos dias do recorte. Exibe mínimo, média, mediana e máximo. A média é por leitura, sem ponderação por dia ou exposição.
- A faixa é amplitude observada, não intervalo de confiança, previsão ou critério de qualidade ambiental. Não altera elegibilidade nem compara extremos com uma referência de média.
- As tabelas mostram os mesmos valores, incluindo contagem. O perfil horário antigo, arquivado somente com média, continua assim; recalcular com as entradas disponíveis cria outra execução com os novos agregados.

## Comparação por dia da semana

São sete grupos, de segunda a domingo, no deslocamento UTC confirmado do caso. Cada grupo contém somente leituras incluídas, do parâmetro/unidade e período selecionados. Calculam-se mínimo, Q1, mediana, Q3 e máximo por interpolação linear de ordem `(n−1)p`, a mesma convenção dos percentis existentes. Grupos sem leituras têm estatísticas nulas e não são desenhados como zero. Uma leitura ou série constante produz estatísticas coincidentes.

**Convenção explícita desta implementação:** a caixa vai de Q1 a Q3, o traço é a mediana e as hastes vão ao mínimo/máximo, incluindo extremos. Essa variante difere das figuras com hastes de 1,5 IQR e pontos de outliers do TCC. Não há identificação automática de outliers nem descarte de extremos, e a legenda informa a convenção. A comparação é descritiva, sem teste de significância entre dias.

## Arquivos e compatibilidade

- Excel: perfil horário acrescido de mínimo, mediana e máximo; nova aba **Dias da semana**, com quartis e extremos. CSV por janela já continha os extremos e a mediana e preserva seu contrato.
- PDF: a série temporal inclui a faixa e escala pelos extremos; a tabela acrescenta mínimo, mediana e máximo. O relatório continua sem figuras separadas do perfil e boxplot.
- Pacotes completos, compartilháveis e histórico conservam os novos agregados com validação de tipos, ordem dos quartis e total por dia. O compartilhável permanece sem leituras individuais. Esquema 1 compatível com os campos opcionais dos pacotes antigos.
- Software 0.1.5. Método `descritivo-2` preservado: as fórmulas existentes de média, percentis, inclusão e referência não mudam; foram adicionados agrupamentos e representações documentados acima.
- O conector ISEQ continua sem prazo total padrão, conforme a 0.1.4. Nenhuma alteração de backend, sessão ou credenciais foi necessária.

## Verificação

Regressões usam gabarito independente de quartis, fuso na virada da data UTC, exclusões/unidade, extremos negativos, lacunas e janela isolada. Excel e ambas as modalidades de pacote são confrontados com os agregados; legado somente com média é preservado e quartis/perfil contraditórios são recusados.

No navegador, o build de produção foi exercitado com dados sintéticos em CO₂ horário com lacunas, PM₂,₅ diário e recorte de um único dia. Foram conferidos quatro gráficos, tabelas de 24 horas e sete dias, temas claro/escuro e ausência de rolagem horizontal global na largura testada. A inspeção do recorte de um dia encontrou e corrigiu o tratamento de categorias vazias do boxplot. O PDF sintético foi renderizado e inspecionado em suas duas páginas.

Contagem final de testes/build e publicação: consultar [registro de execução](EXECUCAO.md). O teste desta apresentação não valida as medições físicas do instrumento nem substitui a revisão científica do estudo.
