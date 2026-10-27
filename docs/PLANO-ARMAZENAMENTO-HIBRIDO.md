# Armazenamento híbrido — decisão de 27/10/2026

**Estado:** direção acordada com Eduardo; implementação pendente. O aplicativo público continua na versão 0.1.3, com o comportamento descrito em `PACOTES.md` e `ISEQ-0.1.3.md`.

## Decisão

Aproveitar a capacidade disponível do banco da ISEQ para históricos e continuar armazenando novos lotes no computador de cada pessoa quando o orçamento seguro da nuvem for alcançado. A pessoa autoriza a pasta de destino e pode importar/reabrir os dados locais. Escola e hospital mantêm suas identidades de caso e sensor em todos os destinos.

Essa decisão não exige uma conta por sensor e não modifica o método analítico. O armazenamento híbrido é uma decisão de infraestrutura, sem promessa de contribuição científica ou ganho de velocidade antes da avaliação.

## Orçamento da nuvem

- Considerar a cota do projeto da ISEQ, sem contar espaço de projetos de outros produtos. Na consulta de 27/10/2026, o plano era Free, com cota documentada de 500 MB por projeto e uso total medido de aproximadamente 141 MB. Essa leitura é um retrato, não uma capacidade fixa.
- Parâmetros iniciais propostos: aviso a 80% e encaminhamento de novos lotes ao armazenamento local a 90% da cota. Com 500 MB, correspondem a 400 MB e 450 MB. A margem restante atende índices, metadados, sessões, tarefas e variação das estimativas.
- Medir o uso total do projeto e estimar cada lote, incluindo índices e concorrência. Reservar o crescimento previsto antes de aceitar gravações em nuvem; encaminhar para o computador quando a previsão ultrapassar o orçamento.
- Distinguir cota comercial e espaço físico do disco. Não esperar restrição do provedor ou disco cheio para mudar de destino.
- O orçamento de históricos deve reservar espaço para controle e autenticação. Atingi-lo não deve impedir entrar, consultar históricos existentes ou transferir novos dados ao computador.
- Não excluir nem sobrescrever históricos da nuvem automaticamente para abrir espaço. Eventual remoção futura exige cópia verificada e ação explícita do responsável.

## Fluxo da pessoa

1. Selecionar sensor/período e conferir os intervalos já disponíveis na nuvem e no computador.
2. Receber indicação de destino antes da transferência: nuvem disponível ou pasta local necessária.
3. Autorizar uma pasta quando o modo local for escolhido ou necessário. Recusar/cancelar recupera o formulário e preserva os dados existentes.
4. Obter somente períodos faltantes, quando a cobertura registrada permitir essa decisão. Leituras de sensores diferentes nunca são deduplicadas entre si; conflitos não desaparecem silenciosamente.
5. Confirmar a gravação e a integridade do lote antes de indicá-lo como salvo. Gerar um arquivo ou disparar um download não confirma que ele foi salvo pelo navegador.
6. Reabrir/importar os arquivos locais para analisar e exportar; recalcular exige ação explícita e mantém a execução anterior.

A interface deve indicar destino, sensor, período, tamanho, cobertura e estado da gravação. Não pressupor que arquivos de outro computador existam no dispositivo atual.

## Arquivos e reprodução

- Preservar originais recebidos, hashes, sensor/caso, unidades, fuso, períodos, lacunas, conflitos, decisões e versões. Uma atualização não substitui silenciosamente o original.
- Manter catálogo local reconstruível a partir dos arquivos/manifestos, com detecção de arquivos ausentes ou alterados.
- Dividir históricos por sensor/período/tamanho. Os limites atuais do pacote `.aircase` continuam válidos: não gerar arquivos que o próprio app não consiga reabrir. Mudanças de esquema exigem versionamento e compatibilidade explícitos.
- Oferecer download/importação convencional onde o navegador não suportar acesso direto a pastas. Gravação direta exige autorização e suporte do navegador.
- A cópia local pertence ao dispositivo escolhido. Backup e transporte entre computadores são ações explícitas; sincronização automática não faz parte desta decisão.
- Senhas e tokens ficam fora dos arquivos, pacotes e catálogos de pesquisa.

## Mudanças necessárias

O backend atual usa um único `DATABASE_URL` e persiste sessões, tarefas, cobertura e leituras. Autorizar uma pasta no navegador, isoladamente, não desativa essa persistência.

Será necessário separar históricos e controle de autenticação/tarefas, transferir dados por lotes com retenção temporária limitada no servidor e registrar onde cada lote foi confirmado. Os dados destinados ao computador não devem ser primeiro inseridos integralmente no PostgreSQL, pois isso consumiria a cota que o modo local pretende poupar.

Reutilizar históricos reduz consultas repetidas, mas a primeira obtenção ainda depende da ISEQ, da rede e do conector. O armazenamento local não elimina por si só o cold start do Render ou a pausa do Supabase. As análises dos arquivos já salvos devem funcionar mesmo com esses serviços indisponíveis.

Desenvolver em versão/serviço de pesquisa isolado ou contrato compatível, preservando o beta e os históricos existentes, sem migração destrutiva na ativação.

## Sequência e aceite

1. Especificar lote, catálogo, confirmação de gravação e cobertura por destino.
2. Implementar pasta autorizada, importação convencional, cancelamento e recuperação de gravações interrompidas.
3. Adaptar o conector para transferência temporária e orçamento com reserva para lotes concorrentes.
4. Integrar busca incremental e localização dos históricos nos dois destinos.
5. Verificar os cenários abaixo e documentar a versão antes de habilitar o modo aos dados reais.

Critérios: troca de destino antes de ultrapassar o orçamento; autenticação/controle preservados; permissão recusada, pasta indisponível, disco cheio, arquivo corrompido, cancelamento e recarregamento sem falso sucesso; interrupção sem cobertura fictícia ou perda da única cópia; concorrência respeitando reservas; resultados equivalentes nos destinos com os mesmos dados/configurações; reabertura preservando proveniência e versões; ausência de credenciais nos arquivos e no Git.

## Referências verificadas em 27/10/2026

- [Cotas do Supabase](https://supabase.com/docs/guides/platform/billing-on-supabase).
- [Tamanho de banco e disco](https://supabase.com/docs/guides/platform/database-size).
- [Autorização de pasta no navegador](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker).
- [Persistência de dados internos do navegador](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).
