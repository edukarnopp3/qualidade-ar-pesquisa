# Incidente da conexão ISEQ — 09/10/2026

**Estado:** banco restaurado e saudável; backend recuperado com saúde HTTP 200, PostgreSQL persistente e autenticação pronta. Login/listagem real da ISEQ aguardam validação pelo pesquisador.

## Falha observada

Após a publicação da 0.1.3, Eduardo informou que a conexão real continuava sem funcionar. Uma nova chamada pública a `/api/health`, sem credenciais, expirou em 35,08 segundos. Os testes sintéticos anteriores verificaram o cliente e não comprovaram disponibilidade do serviço real.

Com o acesso ao Render realizado pelo usuário, foram verificados o serviço existente `iseq-export-backend`, plano Free, e os logs de execução. O processo falha durante a conexão inicial ao PostgreSQL/Supabase:

```text
sqlalchemy.exc.OperationalError
psycopg.OperationalError
FATAL: (ENOTFOUND) tenant/user <identificação omitida> not found
```

A identificação do projeto, a URI completa, a senha e outras variáveis secretas foram omitidas deste registro. Não foram exportados logs brutos nem configurações secretas.

## Impacto e diagnóstico

No código inspecionado, `DatabaseStore` é criado ao importar o aplicativo, e `Base.metadata.create_all` abre a conexão antes de o servidor aceitar requisições. Uma falha nesse ponto encerra o processo; `/api/health` e o login ficam indisponíveis, e a intermediação do Render pode permanecer mostrando “Application loading”. Os logs confirmaram erro de banco nesse caminho de inicialização.

O último commit mostrado como implantado no serviço era `a7f3df134b5e3a387a0da9d0a28beb6c41a530ee`, no repositório beta existente. O reinício operacional usou esse mesmo código; não houve implantação de outra versão do backend.

O pooler compartilhado rejeita a correspondência entre host e identificação do projeto/usuário. A [orientação oficial do Supabase](https://supabase.com/docs/guides/troubleshooting/tenant-or-user-not-found) recomenda conferir a conexão fornecida pelo diálogo Connect; o erro não comprova senha incorreta. Também é necessário verificar se o projeto está ativo ou pausado. A [documentação de pausa e retomada](https://supabase.com/docs/guides/platform/free-project-pausing) descreve a recuperação do projeto existente.

## Recuperação prevista

1. Abrir o projeto Supabase usado pela conexão atual e verificar sua identidade e estado.
2. Retomar o projeto existente se estiver pausado, ou comparar host/porta/usuário com o diálogo Connect se estiver ativo.
3. Corrigir somente a configuração necessária, mantendo banco/dados existentes, senha e `APP_SECRET`. Não substituir a base por um projeto novo nem alterar credenciais sem necessidade comprovada.
4. Reiniciar o mesmo código do backend se necessário, após a correção do banco/configuração.
5. Confirmar resposta JSON de saúde com prontidão da autenticação, medir o tempo real, e então conferir login/listagem de sensores e uma consulta curta conduzida pelo pesquisador.

O usuário realizou os acessos ao Render e Supabase. O projeto encontrado no Supabase coincide com a conexão do backend e estava pausado. O painel informou que seus dados permaneciam preservados. A ação **Resume project** foi confirmada; o estado passou a **Coming up...**. Não foram editados URI, senha, `APP_SECRET` ou código, nem contratado outro plano. A declaração do painel sobre os dados não substitui a conferência posterior dos históricos.

## Verificação operacional

- Às 13h39 (America/Sao_Paulo), o Render registrou **Service restarted by you**. Às 13h40, registrou nova falha de processo. O indicador de deploy antigo `Live` não comprovou disponibilidade atual.
- A chamada pública de saúde posterior expirou em **70,07 s**, sem autenticação ou envio de credenciais.
- Às 13h43min40s, um evento do **Supavisor** no próprio Supabase também registrou `ENOTFOUND tenant/user not found`. Os serviços Database, PostgREST, Auth, Realtime e Storage continuavam em inicialização; Connect permanecia desabilitado.
- A página de uso não mostrou cota excedida no ciclo atual. O aviso geral sobre fim da carência não foi tratado como prova de bloqueio por cobrança. Os indicadores de uso podem sofrer atraso de atualização.
- As configurações gerais ainda ofereciam **Resume project** e descreviam a base como pausada. Por essa divergência, foi feita uma segunda tentativa pelo controle de disponibilidade; o painel voltou a `Coming up...`. Não foram usados pausa, exclusão, migração ou aumento de recursos.

## Recuperação confirmada

Às 13h52, o Supabase exibiu **Restoration complete!** e, ao retornar ao projeto, **Healthy**, com Connect disponível e conexões de banco presentes. A confirmação ocorreu depois da segunda solicitação de retomada; a observação não permite atribuir a recuperação especificamente a uma das duas solicitações.

Foi solicitado novo reinício do mesmo serviço no Render, com o banco ativo. A consulta pública iniciada às 13h52 respondeu em **41,62 s**, com:

```json
{"status":"ok","database":"postgresql","persistent_storage":true,"auth_ready":true}
```

A consulta seguinte respondeu **HTTP 200 em 0,42 s**, com o mesmo conteúdo e `Access-Control-Allow-Origin: https://edukarnopp3.github.io`. O preflight OPTIONS para o login, com origem do site, método POST e cabeçalho content-type, também respondeu HTTP 200 e autorizou a origem. Esses controles não enviaram login, senha ou token. O tempo inicial inclui a retomada/inicialização do serviço; não é uma medição do tempo de autenticação ou download da ISEQ.

A pausa do banco era uma causa real da indisponibilidade. Sua restauração recuperou a inicialização do backend sem editar a conexão ou trocar código. O [guia oficial de saúde dos serviços](https://supabase.com/docs/guides/troubleshooting/project-status-reports-unhealthy-services) explica a dependência dos demais serviços em relação ao banco.

Ainda faltam autenticação ISEQ, listagem real e consulta curta. A prontidão do backend não comprova acesso ao fornecedor nem integridade de todo o histórico. O pesquisador foi solicitado a validar o login na versão 0.1.3.

## Chamado de contingência

Foi preparado um rascunho local enquanto o projeto permanecia indisponível. O usuário autorizou o contato caso a indisponibilidade continuasse. A restauração concluiu antes do envio, e o chamado permaneceu como rascunho. Não houve concessão de acesso diagnóstico ao banco nem envio de credenciais ou medições para suporte.
