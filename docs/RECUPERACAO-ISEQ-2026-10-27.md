# Verificação e retomada ISEQ — 27/10/2026

## Diagnóstico confirmado

O site público respondeu HTTP 200 e a versão 0.1.3 abriu no navegador. A demonstração sintética escolar foi processada e a tela de exportação ficou disponível.

O endpoint público `https://iseq-export-backend.onrender.com/api/health` não respondeu dentro de duas tentativas, com limites de 50 e 40 segundos. Esses timeouts não identificam, isoladamente, a causa interna do serviço.

O conector autenticado do Supabase confirmou o projeto existente da ISEQ em estado `INACTIVE`. O projeto separado do Nexo também estava inativo e não recebeu nenhuma ação. O Supabase documenta a pausa automática de projetos gratuitos com baixa atividade: https://supabase.com/docs/guides/platform/free-project-pausing.

## Ação operacional

Foi solicitada a retomada do projeto existente da ISEQ pelo conector do Supabase. A operação retornou `success: true`; as leituras posteriores passaram de `COMING_UP` para `RESTORING` e finalmente `ACTIVE_HEALTHY`. Uma consulta de prontidão `select 1 as database_ready`, inicialmente indisponível durante a inicialização, passou a retornar `database_ready: 1`. Isso confirma a recuperação do banco pelo canal de gerenciamento, sem testar a credencial configurada no Render.

Mesmo com o banco saudável, a consulta pública de saúde com origem GitHub Pages expirou em 45,07 segundos. O navegador exibiu a página intermediária **Render — Application loading**, sem JSON de saúde. A restauração do banco não foi suficiente para confirmar a recuperação do backend nesta sessão. Os logs autenticados do Render continuam necessários para distinguir uma reinicialização pendente de eventual falha da configuração ou de outra causa.

O painel de logs do serviço `iseq-export-backend` no Render inicialmente exigiu autenticação. O pesquisador primeiro escolheu continuar sem esse acesso e, mais tarde, informou que conseguiu abrir o painel. Foi então aberta a página de logs do serviço existente, que mostrou o servidor Uvicorn iniciado, inicialização da aplicação concluída e três entradas de saúde HTTP 200 na área visível. O painel também continha erros de banco/tenant; nenhum erro de senha foi identificado na área observada. Não foram copiados logs brutos ou dados de conexão. Nenhum reinício ou deploy manual no Render foi executado nesta sessão.

## Recuperação do backend confirmada

Uma nova consulta pública ao endpoint de saúde respondeu **HTTP 200 em 0,32 segundo**, com:

```json
{"status":"ok","database":"postgresql","persistent_storage":true,"auth_ready":true}
```

Uma verificação adicional com a origem `https://edukarnopp3.github.io` confirmou HTTP 200 e o cabeçalho `Access-Control-Allow-Origin` correspondente. O preflight OPTIONS de `/api/auth/iseq/login` também respondeu HTTP 200, permitindo a origem e os métodos GET, POST e OPTIONS. Nenhuma credencial foi enviada nessas verificações.

O painel público de status do Render informou todos os sistemas operacionais e nenhum incidente em 27/10/2026, e a página de login do dashboard respondeu HTTP 200 em 1,05 segundo. Esses sinais não excluem falhas localizadas anteriores. O serviço recuperou sua resposta pública após a retomada do banco, sem ação manual de reinício no Render; os tempos observados não permitem decompor a demora de cada componente.

O formulário **Obter histórico da ISEQ** foi aberto no aplicativo para que o pesquisador realize a autenticação real e confirme sensores e uma faixa curta de histórico. A prontidão de infraestrutura não confirma esse fluxo completo.

## Exportação local

O comando `node --test tests/packages-export-regression.test.js` passou em **14 de 14 testes**, incluindo leitura dos valores do Excel gerado, preservação do contexto da execução, PDF e abertura dos pacotes. O teste usa dados sintéticos e não valida a aquisição de dados reais da ISEQ.

O botão **Baixar Excel** na página pública exibiu a mensagem de geração concluída, sem erro de console observado. O evento de download não foi confirmado pela automação; isso não comprova, por si só, um defeito no exportador. O salvamento do arquivo no navegador do pesquisador permanece pendente. Nenhuma alteração especulativa no código de exportação foi feita.

## Estado e próximas verificações

- Banco: retomado, `ACTIVE_HEALTHY`, com consulta de prontidão aprovada.
- Backend: recuperado, HTTP 200 com PostgreSQL persistente e autenticação pronta; CORS e preflight de login aprovados.
- Render: painel acessado e logs conferidos; servidor iniciado e respostas HTTP 200 observadas, sem reinício/deploy manual.
- ISEQ: login, sensores e consulta curta com dados reais ainda pendentes.
- Download local: confirmar o arquivo salvo pelo navegador do pesquisador.

O histórico de exposição de credencial continua sendo uma pendência independente: a rotação da senha do banco e a atualização correspondente no Render não foram confirmadas nesta sessão. Nenhuma senha, URI de conexão privada, token ou medição institucional foi registrada neste documento.
