# Contrato do pacote .aircase

ZIP com esquema 1: `manifest.json`, `case.json`, `execution.json`, `history.json`, instruções e, no completo, `inputs/<sourceId>.bin`.

O manifesto registra versão do esquema/software, data, modalidade e SHA-256 de cada componente. Fontes originais também têm hash conferido. Hash detecta alteração em relação ao manifesto; não equivale a assinatura, autenticidade ou autoria. O manifesto é parte do arquivo e não tem assinatura digital.

Completo: contexto congelado, observações/decisões e arquivos originais **da execução selecionada**, conferidos por ID/hash, e até 30 itens de histórico. Os demais itens levam apenas resultados/metadados, identificados como `results-only`; suas bases não são duplicadas no ZIP. Para reproduzir bases diferentes, conserve seus respectivos pacotes completos.

Compartilhável: resultados agregados e metadados permitidos por listas explícitas. Observações, ocorrências por linha, decisões/justificativas, notas, mapeamentos e contexto externo privado são retirados do caso, snapshot, execução e histórico. Esse pacote abre resultados, mas não edita a base ou recalcula. Identificação do ambiente, fonte da referência e valores agregados ainda devem ser revisados antes de compartilhar; não há promessa de anonimato.

Reabertura verifica estrutura, hashes, tipos, números finitos e vínculos de caso/sensor/execução/fontes antes de renderizar. Integridade de hash sozinha não torna um esquema válido. Recalcular exige ação explícita e entradas disponíveis, criando outro ID/data. Legados de esquema 1 sem contexto congelado recebem aviso de limitação histórica; esquema diferente é recusado. A preferência de tema é o único dado salvo em localStorage. Casos e sessões ISEQ não são salvos no navegador.

## Limites do contrato 0.1.2

Um único conjunto governa geração e abertura: ZIP de até 80 MiB, conteúdo expandido até 160 MiB, manifesto até 256 KiB, até 1.000 fontes além dos três JSON de dados, até um milhão de observações/ocorrências/decisões, 30 execuções históricas e 20 mil janelas por execução. Caminhos extras, fontes duplicadas ou originais com tamanho/hash divergentes são recusados. Limites de contagem/tamanho não garantem desempenho em todo dispositivo. Pacotes com 148 e 1.000 fontes pequenas e bases históricas têm regressões de ida e volta.

A conferência do domínio estatístico admite erro de arredondamento de até `1e-9 × max(|mínimo|, |máximo|)`, com piso `Number.MIN_VALUE`, sem alterar os resultados armazenados. Perfil horário com linhas exige distribuição válida e contagem igual ao total de leituras; legado sem ambos continua aceito. O fuso da execução é inteiro de −840 a 840 minutos e deve coincidir com seu snapshot. Série constante admite uma faixa única com limites iguais ao mínimo/máximo observado.
