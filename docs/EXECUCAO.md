# Execução em 08/10/2026

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

## Pendências científicas e operacionais

1. Obter a primeira consulta histórica real na ISEQ, com autenticação da conta do pesquisador. Nenhuma credencial foi solicitada em chat nem incorporada ao código.
2. Confirmar fabricante/modelo, unidades reais, princípio de medição, frequência nominal e metadados de cada ambiente. COVs/NOx continuam descritivos quando unidade/validade não foram confirmadas.
3. Revisar fontes e edições, método, janelas, critérios de suficiência e requisitos externos. As regras cadastradas são declaradas pelo pesquisador; o software não verifica automaticamente a validade documental.
4. Medir capacidade com períodos reais e realizar revisão visual/a11y completa em estados adicionais. Os limites atuais são proteções de tamanho, sem garantia de desempenho em qualquer dispositivo.
5. Elaborar gabarito independente, separar desenvolvimento/avaliação, congelar protocolo e comparar com o Excel real.
6. Confirmar enquadramento/orientação/autorizações institucionais e licença autoral do software.

## Escopo que permanece posterior

Tempo real, alertas, previsão, controle de ventilação, contas do software, nuvem/collaboração e certificação automática. A conexão histórica ISEQ não constitui monitoramento contínuo.
