# Plano integrado — pesquisa e software de qualidade do ar

**Versão:** 0.5 — 8 de outubro de 2026.
**Autor da proposta:** Eduardo.  
**Programa pretendido:** Mestrado Profissional em Tecnologia e Ambiente (PPGTA), IFC Campus Araquari.  
**Status:** primeira implementação funcional 0.1.0 executada em projeto separado; verificações controladas e de interface concluídas; autenticação histórica real ISEQ, documentação dos sensores e referências científicas permanecem pendentes.

## 1. Proposta em uma página

**Título provisório:** Desenvolvimento e avaliação de um método rastreável para interpretação de séries históricas de qualidade do ar interior: aplicações em uma escola e um ambiente hospitalar.

**Problema observado:** Eduardo refaz manualmente análises no Excel para organizar séries de sensores, produzir gráficos e interpretar resultados. A pesquisa caracterizará esse processo real: etapas, recursos já reutilizados, tempo, retrabalho e dificuldade de recuperar a origem das conclusões. Essas dificuldades serão documentadas, sem pressupor que toda análise em Excel seja inadequada.

**Pergunta:** Em que medida um método documentado e implementado em software melhora a eficiência, a consistência e a rastreabilidade da análise histórica de CO₂ e PM₂,₅ em relação ao fluxo manual utilizado pelo pesquisador, nos casos estudados?

**Objetivo geral:** Desenvolver e avaliar um método rastreável de análise histórica que explicite tratamento dos dados, agregação temporal, seleção de referências e condições em que uma interpretação pode ou não ser sustentada.

**Entregas:** dissertação ou trabalho de conclusão conforme exigências do programa; software; protocolo de análise; documentação e pacote de reprodução dos procedimentos.

**Proposições a avaliar:** o método pode reduzir o tempo de tarefas repetidas, preservar a correção dos cálculos, tornar as decisões reproduzíveis e identificar dados ou contexto insuficientes. Não há percentual de ganho prometido. Resultados negativos ou ganhos restritos também deverão ser relatados.

**Contribuição candidata:** especificação e avaliação de um fluxo que liga cada resultado ao dado de origem, às transformações, à qualidade/completude, ao ambiente, à referência e sua versão e à janela de cálculo. A revisão de literatura deverá demonstrar qual parte dessa contribuição acrescenta conhecimento ou resolve uma necessidade ainda insuficientemente atendida.

## 2. Encaixe no IFC de Araquari

O IFC apresenta o PPGTA como mestrado profissional. A linha **Tecnologias Ambientais** é a candidata mais próxima, por tratar de desenvolvimento tecnológico e monitoramento ambiental. O encaixe desta proposta é uma interpretação inicial que precisa ser discutida com docente da linha, especialmente por usar ambientes interiores escolares e hospitalares.

A página oficial de Produtos Técnicos-Tecnológicos lista **Software/Aplicativo** e **Manual/Protocolo** entre as modalidades admitidas. Informa que o produto deve ter impacto ambiental, relação com o trabalho de conclusão, supervisão do orientador e avaliação institucional. Isso oferece um caminho concreto para software e protocolo, mas a elegibilidade e homologação dependem do programa.

A justificativa ambiental deverá mostrar como a ferramenta apoia análise de poluentes, diagnóstico e acompanhamento de condições ambientais, com limitações explícitas. Um estudo concentrado apenas no tempo de uso de uma interface pode enfraquecer a aderência. Por isso a avaliação inclui qualidade da interpretação ambiental, agregação, suficiência dos dados e sensibilidade das conclusões às escolhas metodológicas.

Antes de adaptar para submissão: conferir o edital vigente, modelo de pré-projeto, critérios de avaliação, regulamento e requisitos do PTT. A página de ingresso de 2026 fornece um modelo e formulários de avaliação; serve como referência inicial, sem presumir que rege uma seleção futura.

Fontes oficiais consultadas em 08/10/2026: [linhas de pesquisa](https://ppgta.ifc.edu.br/linhas-de-pesquisa/), [PTT](https://ppgta.ifc.edu.br/produtos-tecnicos-tecnologicos-ptt/), [ingresso regular 2026](https://ppgta.ifc.edu.br/ingresso-regular-2026/), [portal SIGAA](https://sig.ifc.edu.br/sigaa/public/programa/portal.jsf?id=1058&lc=pt_BR). Algumas páginas tiveram falha na abertura direta; as informações citadas foram recuperadas nos resultados indexados das próprias páginas oficiais. O regulamento integral não foi auditado nesta etapa.

## 3. Escopo acordado e limites

| Elemento | Escopo inicial |
|---|---|
| Usuário principal | Eduardo, como pesquisador |
| Dados | Séries históricas dos dois sensores existentes; arquivos Excel como entrada principal |
| Casos | Uma escola e um ambiente hospitalar, analisados individualmente |
| Núcleo analítico | CO₂ e PM₂,₅, condicionado à documentação dos instrumentos e das referências |
| Outros parâmetros | Disponíveis para exploração; temperatura/umidade contextualizam; COVs, NOx e demais canais dependem de grandeza, unidade e método confirmados |
| Gráficos claros | Recurso para análise e apresentação; compreensão de público leigo não é desfecho principal |
| Apresentação | Painel interativo e PDF sintético em linguagem acessível, com tabela e pacote técnico para reprodução |
| Interface | Adaptação do sistema visual vigente do Nexo: tokens, tipografia, temas e padrões; paleta específica e estável para séries científicas |
| Execução | Aplicação web acessada por link; planilhas selecionadas, analisadas e exportadas no navegador do usuário |
| Salvamento | Pacote local reabrível; opção completa com arquivos originais e versão compartilhável sem os originais |
| Integração ISEQ | Recurso reaproveitável, opcional para o experimento; o estudo deve funcionar com arquivos históricos |
| Tempo real, previsão e controle de ventilação | Possibilidades posteriores, fora da primeira versão científica |

Escola e hospital não são grupos que permitam atribuir diferenças ao tipo de instituição. Há um sensor por contexto; ambiente e equipamento se confundem. A série temporal extensa não transforma dois sensores em grande amostra de instituições. A concordância entre sensores só tem interpretação de desempenho instrumental quando as condições de comparação a justificarem, por exemplo em co-localização documentada.

O método avalia os registros fornecidos e sua interpretação. Correção computacional não comprova exatidão física do sensor. Comparar valores com uma referência não certifica conformidade oficial, exposição individual ou risco sanitário. O software deve diferenciar observação, comparação tecnicamente admissível e conclusão insuficientemente sustentada.

## 4. Objetivos específicos

1. Caracterizar os sensores, dados, metadados e o fluxo Excel efetivamente utilizado.
2. Revisar trabalhos próximos e confirmar referências aplicáveis às grandezas e ambientes disponíveis.
3. Especificar tratamento, completude, agregação, interpretação e rastreabilidade.
4. Implementar o método em um protótipo, documentando o código herdado do beta e as adições da pesquisa.
5. Demonstrar a aplicação nos dois casos e analisar a sensibilidade dos resultados às decisões metodológicas.
6. Avaliar correção, eficiência, consistência, rastreabilidade e reprodução, com alcance compatível com o desenho efetivamente realizado.

Design Science Research é uma opção para organizar problema, objetivos, construção, demonstração, avaliação e comunicação. Sua adoção depende do enquadramento com o orientador; não substitui os métodos de análise ambiental e a avaliação empírica. Fonte: [Peffers et al., 2007](https://doi.org/10.2753/MIS0742-1222240302).

## 5. Revisão de literatura e contribuição

A busca realizada até aqui é exploratória. Não autoriza afirmar ineditismo.

| Antecedente | Evidência acessível | Implicação |
|---|---|---|
| [Air Watch, Silva et al., 2026](https://doi.org/10.54899/rpd.v17n4-3091) | Resumo primário indexado: aplicativo hospitalar com registro estruturado, cálculos associados à NBR 17037, gráficos, alertas, relatórios e avaliação de usabilidade; texto integral não acessado nesta etapa | Essas funções não sustentam sozinhas a novidade; obter e comparar o artigo integral |
| [Ge et al., 2025, Boston](https://pmc.ncbi.nlm.nih.gov/articles/PMC12206041/) | Tratamento, completude e visualização de séries de CO₂ em escolas | Histórico, gráficos e controle de qualidade têm antecedentes; critérios do artigo não se transferem automaticamente |
| TCC do pesquisador (Karnopp, Chaves e Leitzke, 2026; arquivo PDF fornecido nesta conversa) | Monitoramento de uma sala de aula por 34 dias, aproximadamente um registro/minuto e 93.899 registros; análise descritiva em planilhas de CO₂, frações de MP, temperatura, umidade e pressão. NOx e COV foram excluídos por comportamento instrumental considerado inconsistente | Dá continuidade empírica e mostra por que os canais precisam ser avaliados individualmente; confirmar se o conjunto e o sensor do TCC correspondem à série escolar atual; não transportar resultados de conformidade sem revisar métodos e janelas |
| [Rose et al., 2024](https://doi.org/10.1155/2024/5544298) e [Schibuola e Tambani, 2020](https://doi.org/10.1016/j.apr.2019.11.006) | Estudos escolares com monitoramento de partículas e CO₂, classificação ambiental ou investigação de fontes | Monitoramento e visualização já têm antecedentes; a proposta deve sustentar sua contribuição no método e na avaliação |
| [Rastogi e Lohani, 2022](https://doi.org/10.1016/j.iswa.2022.200132) | Framework contextual de qualidade do ar interior com pré-processamento e regras | Contextualização genérica não demonstra contribuição nova |
| [EPA, garantia da qualidade de sensores](https://www.epa.gov/air-sensor-toolbox/quality-assurance-air-sensors) e [guia de análise de 2025](https://www.epa.gov/system/files/documents/2025-03/final508_epa-analyzing-air-quality-guide_250306.pdf) | Fundamentos de finalidade, qualidade, validação e documentação | Usar como fundamento, distinguindo recomendações existentes das adições do projeto |

A leitura do TCC também exige atualizar o tratamento de referências regulatórias: a Resolução RE Anvisa n.º 9/2003 foi revogada pela RDC n.º 886/2024 ([ato oficial da Anvisa](https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&cod_menu=9431&cod_modulo=310&link=S&numeroAto=00000886&orgao=RDC%2FDC%2FANVISA%2FMS&seqAto=000&tipo=RDC&valorAno=2024)). A Resolução CONAMA n.º 506/2024 trata dos padrões nacionais e exige método de referência ou equivalente para verificação legal ([texto oficial](https://conama.mma.gov.br/?id=827&option=com_sisconama&task=arquivo.download)). As normas ABNT citadas no pré-projeto seguem como candidatas, condicionadas à consulta autorizada e à confirmação de escopo, método e edição aplicáveis.

A revisão estruturada deve registrar bases consultadas, data, expressões de busca, critérios de inclusão/exclusão e motivo da seleção. Incluir periódicos, dissertações e documentação de ferramentas relevantes. Exemplos de termos: indoor air quality; historical/time-series data; data completeness; provenance; reproducibility; decision support; software; school; hospital. Complementar com termos em português.

Para cada trabalho, extrair: contexto, instrumento, entrada, qualidade dos dados, agregação, referências, suficiência, proveniência, saída, validação e limites. Classificar cada item como confirmado pelo texto, não informado ou acesso pendente; ausência no resumo não significa ausência da função.

Ao final, produzir uma matriz que compare literatura, beta e proposta. Se o fluxo já existir, reformular a contribuição para sua adaptação justificada e avaliação em uma necessidade brasileira concreta. A pesquisa não dependerá da alegação de ser o primeiro aplicativo.

## 6. Inventário dos dados e referências

Para cada sensor: fabricante/modelo; canais e grandezas; unidades; princípio de medição; faixa e limitações documentadas; intervalo de amostragem; fuso/horário; manutenção/calibração disponível; histórico de instalação e mudanças. Não assumir que a saída COV/NOx é concentração em ppb apenas porque o beta usa essa legenda.

Para cada ambiente: descrição efetiva do local monitorado, posição do sensor, finalidade do espaço, período de operação e contexto conhecido de ocupação/ventilação. Metadados ausentes ficam registrados como ausentes; não serão reconstruídos como fatos sem evidência.

Para cada arquivo: origem, período, parâmetros, número de registros, frequência observada, duplicatas, datas inválidas, faltas, unidade e permissões de uso/divulgação. Preservar original, hash, versão do importador e vínculo com o conjunto normalizado.

O catálogo de referências terá fonte, edição/versão, acesso legítimo, ambiente/escopo, parâmetro, unidade, janela de cálculo, requisitos de medição, período de aplicação quando pertinente e evidência dos critérios de suficiência. Diferenciar referência recomendada, critério normativo e alerta operacional. Não adotar percentual de completude ou limite sem justificativa. Se o critério de CO₂ depender de concentração externa e ela faltar, registrar a impossibilidade da comparação correspondente.

A auditoria definirá quais perguntas são realmente respondíveis. Ela precede a interpretação automatizada e a seleção dos períodos finais de avaliação.

## 7. Evolução do beta e MVP

O beta atual oferece importação, gráficos, estatísticas e infraestrutura ISEQ. A inspeção do código identificou pontos que justificam um método explícito:

| Trecho atual | Mudança necessária |
|---|---|
| [PARAMS: unidades, faixas, referências e alertas](https://github.com/edukarnopp3/edukarnopp3.github.io/blob/main/index_completo_corrigido.html#L2065-L2078) | Separar estilo de regras científicas; verificar alertas de COV/NOx e suas fontes |
| [Filtragem e estatísticas](https://github.com/edukarnopp3/edukarnopp3.github.io/blob/main/index_completo_corrigido.html#L2370-L2410) | Registrar marcação, exclusão e motivo; valores suspeitos não desaparecem silenciosamente |
| [Agregações](https://github.com/edukarnopp3/edukarnopp3.github.io/blob/main/index_completo_corrigido.html#L2380-L2480) | Acrescentar cobertura/suficiência por janela e justificar cálculo com amostragem irregular |
| [Parser](https://github.com/edukarnopp3/edukarnopp3.github.io/blob/main/backend/app/iseq_parser.py) | Registrar linhas rejeitadas e conflitos de duplicação, com política explícita |
| [Persistência/importação](https://github.com/edukarnopp3/edukarnopp3.github.io/blob/main/backend/README.md) | Distinguir intervalo importado de completude ambiental para interpretação |

Esses achados são de leitura de código, não de execução com dados reais ou auditoria completa. O funcionamento atual do serviço hospedado não foi validado.

O MVP terá um fluxo completo:

**Excel original → identificação/unidades → relatório de qualidade → agregações elegíveis → referência aplicável → explicação e gráfico → pacote de exportação reproduzível.**

As saídas devem distinguir: cálculo descritivo; comparação admissível; resultado acima/abaixo da referência usada; ausência de referência aplicável; insuficiência de dados/contexto. As categorias finais serão especificadas com a regra científica. Evitar um indicador único que esconda diferenças entre poluentes ou um rótulo genérico de ambiente seguro.

A primeira implementação será uma fatia completa: um arquivo, um sensor, um parâmetro e uma regra justificável, com rastreabilidade do começo ao fim. Depois ampliar para o segundo ambiente e os demais parâmetros. A lógica analítica deverá ser independente da interface. Importadores e visualizações herdados serão revisados e sua proveniência registrada.

O beta já lê Excel no navegador, mas o fluxo atual exige sessão ISEQ antes de liberar o painel. A normalização local pode agrupar registros por horário sem preservar a identidade de cada sensor; isso precisa ser corrigido antes de importar arquivos da escola e do hospital em conjunto. O painel ativo renderiza três gráficos; resumos, comparações e algumas exportações encontradas no código não estão conectados ao fluxo atual. Estes achados vêm de inspeção estrutural, sem execução com dados reais nem auditoria visual da página renderizada.

No redesign, cada gráfico e cartão deverá indicar unidade, recorte temporal, agregação, contagem e cobertura. Os períodos sem observações precisam ficar visíveis; o rótulo “cobertura” deve separar valores utilizáveis da cobertura temporal esperada. Referências só serão desenhadas quando a janela e o contexto forem elegíveis, com fonte e escopo acessíveis. Os sensores/ambientes ficarão identificados, sem sobreposição automática.

## 8. Protocolo de avaliação

### 8.1 Duas avaliações distintas

**Validação técnica:** cálculos, regras e decisões confrontados com resultados esperados preparados por uma rotina/planilha independente e exemplos pequenos conferidos manualmente. Um especialista/orientador deverá revisar referências e justificativas se disponível. O próprio protótipo e o Excel atual não são o gabarito.

**Avaliação do trabalho do pesquisador:** tarefas equivalentes realizadas no Excel atual e no protótipo final, registrando tempo, conclusão, falhas e rastreabilidade. O Excel deve refletir o fluxo real de Eduardo, incluindo modelos e fórmulas que já reutiliza.

Preservar uma versão do beta. Uma comparação técnica beta versus protótipo, ou uma execução com/sem o novo módulo mantendo interface semelhante, pode ajudar a distinguir benefícios do método e da automatização já existente. Essa análise complementar depende da capacidade das versões; não forçar três interfaces a tarefas incompatíveis.

### 8.2 Dados e tarefas

Separar arquivos usados no desenvolvimento/piloto dos reservados à avaliação. Usar casos reais dos dois ambientes e arquivos sintéticos controlados, identificados como sintéticos, para lacunas, duplicatas, horários fora de ordem, unidade incompatível, janelas incompletas e contexto sem regra. Os sintéticos não constituem novas observações ambientais.

| Tarefa | Entrega verificável |
|---|---|
| Preparar um conjunto histórico | Série identificada, ordenada e relatório de problemas/decisões |
| Descrever variação temporal | Gráfico, agregação e síntese fundamentada nos registros |
| Selecionar/aplicar referência | Fonte, contexto, unidade e janela corretos |
| Quantificar períodos avaliáveis | Valores e denominadores, cobertura e elegibilidade |
| Reconhecer insuficiência | Motivo correto e ausência de conclusão indevida |
| Exportar e reproduzir | Entrada, versão, regras/configuração, transformações e resultados |

Os enunciados fixarão arquivo, contexto, período, pergunta e entrega. Para validação técnica, usar entradas idênticas. Para tempo humano, evitar repetir imediatamente a mesma pergunta no mesmo arquivo; usar conjuntos equivalentes e alternar a ordem dos fluxos, documentando diferenças residuais.

### 8.3 Métricas e vieses

| Dimensão | Medida proposta |
|---|---|
| Tempo | Tempo total; interação, processamento e retrabalho identificados |
| Correção | Itens corretos/verificáveis e erros críticos descritos |
| Conclusão | Completa, parcial, falhou ou demandou assistência |
| Rastreabilidade | Evidência de origem, unidades, transformação, regra/versão, agregação e suficiência |
| Reprodução | Mesma entrada/configuração produz resultados equivalentes nas tolerâncias predefinidas |
| Insuficiência | Detecções corretas e falsas classificações de suficiência |
| Sensibilidade | Mudança de valores/decisões ao variar critérios tecnicamente justificáveis |

Definir tolerâncias, falhas críticas, tempo limite e tratamento de interrupções antes da avaliação final. Apresentar velocidade junto de correção; não remover do resultado tarefas que falharam. O piloto servirá para ajustar o protocolo, depois congelado.

Se só Eduardo participar, os resultados humanos serão um estudo de caso do seu processo. Ele também desenvolve o sistema e conhece suas regras: alternância e treinamento não eliminam esse viés. Especialistas adicionais podem fortalecer revisão e avaliação, mas não há disponibilidade ou número prometido. Repetições, dias e milhares de leituras não equivalem a participantes independentes. Dependência temporal deve ser considerada ao escolher unidades e análises; iniciar com resultados descritivos por tarefa/ambiente e fechar a estatística com o orientador.

Confirmar requisitos institucionais de ética e autorizações antes de recrutar pessoas ou realizar coleta correspondente. Dados institucionais restritos ficarão fora do repositório público.

Fundamentos adicionais: [NIST, avaliação por tarefas](https://www.nist.gov/programs-projects/usability-testing); [Sandve et al., reprodução computacional](https://doi.org/10.1371/journal.pcbi.1003285).

## 9. Etapas, entregáveis e critérios de passagem

| Etapa | Trabalho | Entrega | Critério para avançar |
|---|---|---|---|
| 1 — Enquadramento | Conferir programa/linha/modelo e discutir aderência com possível orientador | Resumo de proposta e dúvidas institucionais | Tema e contribuição adequados ao programa; isso ainda não equivale à admissão |
| 2 — Literatura e dados | Revisão estruturada, inventário e reconstrução do Excel | Matriz de antecedentes, fichas e análise de viabilidade | Lacuna/necessidade defensável e dados suficientes para pelo menos uma aplicação |
| 3 — Método | Catálogo de regras, qualidade, agregação, proveniência e protocolo preliminar | Especificação e exemplos de resultados esperados | Regras justificadas e casos auditáveis; pendências explicitadas |
| 4 — Fatia demonstrativa | Implementar primeiro fluxo completo | Análise rastreável de um arquivo/parâmetro | Resultado reconstruível da origem à exportação |
| 5 — Protótipo/piloto | Ampliar aos dois casos, revisar enunciados e tempos | MVP documentado e protocolo congelado | Validação técnica sem falhas críticas conhecidas nas funções avaliadas |
| 6 — Avaliação | Executar tarefas e sensibilidade com versões fixas | Registros, tabelas e evidências | Resultados completos, inclusive falhas e ausência de ganho |
| 7 — Comunicação/PTT | Discutir limites, documentar uso/transferência e adaptar às exigências do IFC | Trabalho acadêmico, software e protocolo | Revisão do orientador e avaliação institucional |

### Primeiros 30 dias de trabalho

1. **Semana 1:** obter documentos vigentes do PPGTA; preparar resumo para discussão acadêmica; congelar versão do beta; inventariar uma amostra de arquivos de cada ambiente e o fluxo Excel.
2. **Semana 2:** aprofundar antecedentes e montar matriz; confirmar documentação dos canais centrais; elaborar catálogo inicial das referências acessíveis.
3. **Semana 3:** especificar tratamento/completude/agregação, preparar casos pequenos independentes e selecionar uma pergunta ambiental respondível em cada contexto.
4. **Semana 4:** consolidar pré-projeto, requisitos do MVP e protocolo de avaliação. A demonstração pode começar se dados e regras da fatia escolhida estiverem justificados.

Esta sequência é uma proposta operacional, condicionada ao acesso aos dados e à orientação. Para execução da pesquisa, um horizonte inicial de 12 meses pode ser distribuído entre literatura/dados (1–2), método (3–4), protótipo (5–7), avaliação (8–10) e escrita/consolidação (11–12), com escrita contínua. Não é o calendário oficial ou uma promessa de concluir o curso em 12 meses.

## 10. Projeto Git separado e documentação

O novo projeto deverá registrar a relação com o beta, sua versão de origem, licença e módulos reaproveitados. Confirmar licença antes de escolher a licença do novo repositório. A direção acordada é uma aplicação web estática acessada por link, com leitura e processamento de arquivos no navegador. A primeira abertura/atualização precisa de internet; o MVP não exige modo instalável/offline. A análise não dependerá de backend, login, banco de dados ou disponibilidade de serviço remoto. Limites de tamanho/desempenho e detalhes da stack serão definidos após medir arquivos representativos.

Estrutura proposta:

```text
README.md                 objetivo, status, instalação e execução
docs/pesquisa/            pré-projeto, literatura, protocolo e resultados
docs/produto/             requisitos, fluxo, escopo e decisões de produto
docs/design-system/       tokens adaptados, componentes e decisões visuais
docs/metodo/              qualidade, agregação, regras e decisões
docs/manual/              uso, exemplos e limitações
src/                      núcleo analítico, importação, interface e exportação
rules/                    referências e regras verificadas/versionadas
examples/                 dados sintéticos e análises demonstrativas
evaluation/               enunciados, gabaritos e registros permitidos
data/README.md            manifesto e instruções para dados restritos
```

Cada pacote de análise deverá identificar hash da entrada, sensor/contexto, versões do software/regras, configuração, decisões sobre dados e resultados. Alterações de regra produzem nova versão; mudanças após o protocolo congelado precisam ser registradas e podem exigir nova execução.

O produto público pode permitir reprodução do procedimento com exemplos sintéticos. Disponibilizar dados reais exige autorização específica; o manifesto explicará a limitação de acesso. A publicação deverá distinguir elementos do TCC/beta anterior das contribuições do mestrado.

## 11. Riscos e respostas

| Risco | Resposta prevista |
|---|---|
| Funções equivalentes já estudadas | Reformular a contribuição pela revisão; não insistir em ineditismo do dashboard |
| Pouco contexto ou dados incompletos | Reduzir perguntas às respondíveis e estudar suficiência; sintéticos só para validação técnica |
| Aderência ao PPGTA insuficiente | Reforçar avaliação ambiental e discutir enquadramento antes de grande desenvolvimento |
| Apenas o autor avalia | Limitar afirmações ao caso e buscar revisão independente quando viável |
| Ganho de tempo pequeno | Relatar limites e avaliar correção/rastreabilidade sem redefinir sucesso depois dos resultados |
| Referência ou unidade incompatível | Produzir descrição ou inconclusão fundamentada, sem comparação forçada |
| Infraestrutura remota falha | Garantir execução a partir de arquivos e exportação local reproduzível |
| Escopo cresce | Priorizar fatia completa CO₂/PM₂,₅; novos canais e integrações dependem do núcleo validado |

## 12. Decisões registradas e pendências

**Confirmado na conversa:** dois sensores em contextos distintos; pesquisador como usuário principal; dados históricos e Excel como núcleo; apresentação acessível por gráficos/PDF como utilidade; app acessado por link com processamento no navegador; pacotes locais reabríveis, completos ou compartilháveis; reuso adaptado do design system vigente do Nexo, com cores próprias para séries; projeto Git separado e documentação; programa pretendido no IFC de Araquari.

**Proposto neste plano:** método rastreável e software como produto técnico; linha Tecnologias Ambientais como candidata; comparação principal Excel versus protótipo; validação técnica independente e estudo do fluxo; análise complementar do beta e sensibilidade quando viáveis; etapas e cronograma acima.

**Ainda aberto:** orientador/linha confirmados; edital de ingresso pertinente; arquivos reais e autorizações; modelo/documentação/unidades dos sensores; referências licenciadas e critérios de suficiência; contribuição sustentada pela revisão; avaliadores disponíveis; estatística/ética do protocolo; licença do novo repositório; medidas de desempenho em arquivos representativos. A auditoria visual por screenshots da página beta ainda não foi concluída; a inspeção estrutural do código está registrada na seção 14.

Próximo marco concreto: um pré-projeto para discutir no PPGTA, apoiado por matriz de antecedentes, inventário dos dados e um exemplo rastreável de resultado esperado. A aprovação desta proposta de trabalho não constitui aprovação acadêmica do tema.

## 13. Registro da elaboração com múltiplos agentes

Agentes trabalharam em frentes independentes de contribuição científica/literatura, metodologia de avaliação, evolução do beta e inspeção do sistema visual do Nexo. A consolidação incorporou os limites sobre originalidade, completude, comparação dos ambientes, gabarito independente, privacidade local e adaptação do design system. A identificação do IFC fornecida por Eduardo durante a elaboração levou à verificação das páginas oficiais e ao enquadramento do software/protocolo como PTT candidato.

Este arquivo amplia o plano inicial e preserva seu caráter provisório. Nesta etapa houve leitura de documentos, código e fontes e elaboração do plano; não houve implementação, criação de repositório, execução de ensaio com participantes ou validação dos sensores.

## 14. Planejamento do software

### 14.1 Propósito e limites do produto

O produto será uma ferramenta de pesquisa para transformar arquivos históricos dos sensores em análises temporais legíveis, contextualizadas e reproduzíveis. O pesquisador executa e revisa cada análise. A apresentação a públicos sem formação técnica é uma utilidade do painel e do PDF, não um desfecho independente da pesquisa nesta etapa.

O sistema descreve os registros recebidos e aplica regras documentadas. Não certifica conformidade legal, exatidão metrológica, exposição individual ou risco à saúde. Escola e hospital são casos independentes; uma diferença entre eles não será atribuída causalmente ao tipo de instituição.

### 14.2 Fluxo de uso principal

1. Criar ou abrir um caso, identificando ambiente, sensor, período, localização funcional e contexto conhecido.
2. Selecionar arquivo Excel e pré-visualizar abas, cabeçalhos, datas e parâmetros reconhecidos.
3. Confirmar o mapeamento entre colunas e grandezas, unidade, sensor, data/hora e fuso. Sugestões automáticas ficam sujeitas à confirmação.
4. Ler o relatório de qualidade antes de interpretar: linhas aceitas, rejeitadas, sinalizadas, duplicadas/conflitantes, valores ausentes, frequência e lacunas.
5. Definir recorte temporal, parâmetro e análise; registrar a configuração como uma execução versionada.
6. Examinar estatísticas, série temporal, cobertura e janelas elegíveis, com acesso progressivo aos detalhes de cálculo, fonte e transformações.
7. Exportar relatório, tabela e pacote da execução.
8. Reabrir o pacote preservando a execução anterior; recalcular com software/regra atual somente por ação explícita, gerando nova execução.

### 14.3 Módulos funcionais do MVP

| Módulo | Comportamento mínimo |
|---|---|
| Casos | Separar escola e hospital; associar sensor, arquivos e metadados; não combinar registros sem identificação confirmada |
| Importação | Excel como entrada inicial; reconhecer formatos observados; pré-visualizar e confirmar mapeamento; apontar linhas rejeitadas e conflitos |
| Qualidade | Preservar valores e arquivo de origem; identificar datas inválidas, duplicatas, unidade incompatível, amostragem irregular e lacunas; registrar decisões sem exclusão ou imputação silenciosa |
| Análise temporal | Filtros por caso, sensor, parâmetro e período; estatísticas e agregações com unidade, janela, contagem e denominador explícitos |
| Referências | Catálogo versionado por fonte, ambiente, parâmetro, unidade, janela e requisitos; mostrar motivo de aplicabilidade ou impedimento |
| Interpretação | Separar elegibilidade de comparação e resultado: calculável, comparação admissível, acima/abaixo da referência usada, insuficiência de dados/contexto ou referência não aplicável |
| Visualização | Série temporal com lacunas visíveis; perfil por hora quando justificável; distribuição exploratória; referências rotuladas e ligadas à fonte; tabela conferível por janela |
| Exportação | PDF resumido, tabela CSV/XLSX e pacote técnico local; todas as saídas derivadas da mesma execução |
| Pacote/reabertura | Pacote completo inclui os arquivos de entrada; pacote compartilhável exclui os originais e informa a dependência para recalcular; manifesto, versões, configurações e hashes |
| Exemplo | Caso sintético marcado como demonstração; nunca apresentado como medição real |

O painel deve distinguir “leituras utilizáveis” de “cobertura do tempo esperado”. Ausência de dia/hora não pode desaparecer de uma série contínua. Médias de cartões e gráficos devem declarar se usam leituras instantâneas, médias por dia/hora ou outra janela. A visualização pode reduzir pontos para desenhar, sem alterar cálculos, cobertura ou exportações.

### 14.4 Design e apresentação

Fonte de referência: o shell vigente do Nexo em `dist/style.css`, `dist/preferences.js` e capítulo 09 do pacote documental. O nome/logotipo e modelos de negócio do Nexo não serão transferidos ao produto acadêmico. “Vigea” permanece referência histórica de identificadores internos; a autoridade visual consultada é o shell Nexo. O tema do iframe de Análise de lote tem tokens diferentes e não será misturado ao shell.

Elementos visuais de referência: Segoe UI Variable/Segoe UI/Arial; neutros e superfícies do sistema; foco visível; controles e texto legíveis; estados descritos por texto além de cor; detalhes técnicos progressivos; tema claro/escuro com tokens próprios. A interface científica terá componentes e navegação próprios para casos, importação, qualidade, análises, referências e documentação.

As séries usarão uma paleta própria, estável e acessível. A semântica de ações/estados do Nexo não será usada para sugerir que uma leitura está adequada ou excedida. Gráficos e tabelas terão rótulos, unidades, padrões de linha e legendas; o significado não dependerá apenas da cor.

Antes do redesign final, será feita inspeção visual da página renderizada em estados de dados, temas, tamanhos de tela e zoom. A revisão feita nesta fase foi estrutural, baseada no código; ela não atesta espaçamento, contraste ou comportamento visual da página publicada.

### 14.5 Arquitetura e privacidade

- Interface estática hospedada por link; processamento de Excel e geração das exportações no navegador.
- Sem login, persistência em servidor, banco de dados, telemetria de conteúdo ou sincronização no MVP.
- Bibliotecas usadas no processamento devem ser versionadas junto à aplicação sempre que viável; chamadas de rede da análise não podem transmitir arquivo ou metadados do caso.
- Núcleo analítico separado da interface: importação, normalização com proveniência, qualidade, agregação, regras, interpretação, gráficos e exportação.
- Pacote versionado deve permitir conferir integridade, restaurar contexto e manter resultado anterior; nenhuma mudança de regra recalcula silenciosamente uma análise arquivada.
- Repositório público, se escolhido, conterá código, documentação e dados sintéticos. Arquivos reais exigem autorização específica e não entram no repositório.

### 14.6 Critérios para considerar a fatia MVP pronta

1. Um arquivo pode percorrer importação → mapeamento → qualidade → análise → gráfico → PDF/tabela/pacote, mantendo origem e unidade.
2. Arquivos da escola e do hospital continuam separados, mesmo quando timestamps coincidem.
3. Duplicatas, lacunas, erros e exclusões aparecem com motivo e vínculo às linhas de origem.
4. Cada resultado informa parâmetro, unidade, período/janela, agregação, contagem/cobertura, regra e versão.
5. Quando os critérios de suficiência ou contexto falham, a aplicação explica o impedimento e não declara comparação conclusiva.
6. Painel, PDF e tabelas apresentam os mesmos valores e estados para a mesma execução.
7. Reabrir pacote reproduz a execução arquivada; reprocessar explicitamente cria uma nova versão.
8. Arquivos e metadados permanecem no dispositivo; isso será verificado na versão implementada, inclusive dependências e tráfego de rede.
9. Casos controlados conhecidos confirmam cálculos; a própria saída do protótipo não serve como gabarito.

Limites de linhas, tamanho, navegadores e memória serão estabelecidos após medir planilhas representativas. Critérios numéricos de suficiência, arredondamento e tolerância permanecem pendentes de justificativa científica.

### 14.7 Etapas de execução do software

| Etapa | Entrega | Passagem |
|---|---|---|
| A. Inventário | Amostras de Excel, fichas de sensores, frequências/unidades, permissões e fluxo Excel atual | Ao menos uma pergunta histórica respondível por caso e formatos de entrada conhecidos |
| B. Auditoria do beta e do método | Versão congelada; mapa do que está ativo/órfão; licença; referências e regras candidatos | Reuso delimitado; login separado do modo local; risco de mistura de sensores removido no desenho |
| C. Especificação visual/funcional | Fluxo de telas, estados, tokens adaptados, legendas e critérios de aceitação | Revisão do pesquisador antes de codificar o redesign visual |
| D. Fatia vertical | Um sensor/parâmetro e uma regra: Excel → relatório de qualidade → cálculo → gráfico → exportação reabrível | Resultado reconstruível e comparado a gabarito independente |
| E. Ampliação | Dois casos; demais canais cuja unidade/método esteja confirmado; painel, PDF e tabelas | Sem erros críticos conhecidos nos casos congelados; limitações explícitas |
| F. Piloto e congelamento | Tarefas, conjuntos separados e protocolo de comparação com Excel | Enunciados, critérios e versões fixados antes da avaliação final |
| G. Avaliação e entrega | Registros de tempo/erros/rastreabilidade/reprodutibilidade, manual, fontes e documentação | Resultados positivos/negativos relatados e pacote compatível com exigências do IFC |

### 14.8 Fora do primeiro lançamento

Conexão contínua aos sensores, alertas automáticos, previsão, controle de ventilação, colaboração multiusuário, contas, nuvem e decisões automatizadas de conformidade. Poderão ser retomados se a necessidade e a viabilidade forem demonstradas após o MVP.

## 15. Execução inicial — 08/10/2026

Eduardo confirmou nesta etapa que os históricos eram importados online da ISEQ, e não estavam disponíveis como planilhas locais no workspace. A aplicação mantém o núcleo local e recebe um conector opcional ao backend do beta para aquisição histórica. Esse serviço externo possui armazenamento próprio; sua autenticação e aquisição ficam fora da garantia de arquivos inteiramente locais e são iniciadas explicitamente pelo usuário. Senha/sessão não entram nos arquivos ou pacotes do novo software.

Projeto criado em `software-qualidade-ar/`, com código original modular, importação por workers, preservação de registros/decisões, gráficos, referências cadastráveis, PDF/tabelas/pacotes, reabertura e sistema visual Nexo. O beta original permanece como referência separada. Fontes, inventário, método, manual e limites estão documentados no projeto.

Verificações: 24 testes controlados aprovados; build de produção; importação XLSX exercitada no navegador; análise diária/horária; critério sintético e janelas insuficientes; decisão manual; PDF renderizado/inspecionado; pacote reaberto com execução preservada; temas claro/escuro; 390 px sem transbordamento horizontal nos estados conferidos. Isso não representa calibração de sensores, validação com dados institucionais ou avaliação acadêmica final.

As primeiras consultas de diagnóstico ao backend ISEQ expiraram sem resposta; nenhum login real foi realizado. A consulta histórica autenticada e a confirmação de unidades/frequência/documentação dos sensores são as próximas dependências para aplicar o software aos casos reais.

O repositório separado está em https://github.com/edukarnopp3/qualidade-ar-pesquisa e a primeira versão está publicada em https://edukarnopp3.github.io/qualidade-ar-pesquisa/. A página pública foi conferida no navegador em 08/10/2026, com os casos sintéticos da escola e do hospital, gráficos e recorte diário. Evidências e limites ficam em `software-qualidade-ar/docs/EXECUCAO.md`. A avaliação com dados reais e o protocolo acadêmico permanecem pendentes.
