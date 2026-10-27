# ISEQ 0.1.4 — histórico sem limite total de duração

## Alteração solicitada

Em 27/10/2026, Eduardo pediu a remoção do limite de 20 minutos da operação. O cliente do aplicativo passa a aguardar o histórico sem prazo total automático, enquanto o serviço continua respondendo e o usuário mantém a operação aberta.

O construtor `IseqClient` usa `operationTimeoutMs: null` por padrão. O escopo de cancelamento continua existindo, mas não agenda um temporizador de duração total. Um prazo positivo explicitamente configurado por um consumidor técnico continua sendo validado e respeitado; o aplicativo público não configura esse prazo.

## Comportamento preservado

- Cada requisição e leitura de resposta continuam limitadas a 45 segundos por padrão. Isso detecta uma chamada travada, sem interromper uma coleta longa que responde ao polling.
- Prontidão antes do login: até 90 segundos. Encerramento remoto da sessão: até 8 segundos.
- **Cancelar espera** e fechar o modal interrompem a espera local. Respostas tardias continuam protegidas e os listeners são removidos ao encerrar.
- O polling e o diagnóstico de progresso/tempo decorrido continuam ativos. Cancelamento local não garante interrupção do job remoto.
- Falhas e limites próprios do backend/ISEQ, expiração de sessão, limite de linhas e disponibilidade de rede continuam aplicáveis.
- O método analítico, o formato dos pacotes e o beta não foram alterados. Nenhuma credencial ou medição real foi usada nos testes da mudança.

## Verificação

Foram adicionadas regressões com relógio simulado: conclusão de histórico após 25 minutos; cancelamento manual após mais de 20 minutos sem novas consultas; e requisição sem resposta encerrada exatamente pelo prazo padrão de 45 segundos. Os controles existentes de prazo total explicitamente configurado continuam válidos.

A verificação de interface usa o backend de fixtures sintéticas do próprio repositório, com credenciais fictícias, para conferir o novo texto, o progresso e o cancelamento. Não é necessário aguardar 20 minutos reais nem consultar dados institucionais para provar a alteração do temporizador.

Resultado: **119/119 testes aprovados**, build de produção concluído com 808 módulos. No navegador, foram confirmados o cancelamento com recuperação do botão, nova tentativa e conclusão até a conferência de 288 linhas sintéticas, sem erros de console. [Evidência dos testes](evidencias/v0.1.4/testes-finais.txt).

## Aplicação no navegador

Uma aba que já carregou a versão 0.1.3 conserva o código e os temporizadores antigos até ser recarregada. A publicação não altera uma operação já iniciada nessa aba. Antes de recarregar, concluir/cancelar a operação e salvar em pacote qualquer análise que precise ser preservada.
