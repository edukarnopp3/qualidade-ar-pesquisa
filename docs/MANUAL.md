# Manual da versão 0.1.0

1. Abra a aplicação e escolha importar uma planilha, obter histórico ISEQ, reabrir um pacote ou explorar a demonstração.
2. Confira aba, data, parâmetros, sensor, ambiente, fuso e unidades. Intervalo nominal depende do instrumento; deixe pendente quando desconhecido. Marque arquivos sintéticos como demonstração.
3. Revise o relatório de qualidade. Ao escolher uma leitura de um conflito, registre o motivo; todas as origens permanecem disponíveis.
4. Abra Análise temporal. Selecione parâmetro, início/fim e média horária/diária; use Aplicar recorte. Os cartões descrevem leituras instantâneas, e o gráfico descreve médias da janela.
5. Cadastre referência apenas com fonte/requisitos conferidos. Selecione-a no filtro. Sem dados ou contexto suficientes, confira o motivo na tabela.
6. Exporte PDF para apresentação, Excel/CSV para conferência e pacote completo para arquivo de pesquisa. O compartilhável contém somente os agregados/metadados.
7. Ao reabrir um pacote, o estado arquivado aparece. Recalcular cria uma nova execução. Fechar/recarregar a página descarta casos que ainda não foram baixados em pacote.

ISEQ: o formulário mostra o backend exato antes de enviar login. O serviço do beta armazena históricos e tokens do seu lado conforme sua documentação; esta aplicação não grava senha/sessão. Use Sair da ISEQ ou feche a aba para encerrar a sessão local. Cancelar espera interrompe o navegador; não cancela necessariamente o trabalho já criado no backend.

Erro de formato: confira aba e cabeçalhos. Erro de CORS/rede: confira o backend e origem permitida, ou exporte da ISEQ e importe Excel. Limite de memória/tamanho: use arquivos/períodos menores. A falta de parâmetro não representa valor zero.
