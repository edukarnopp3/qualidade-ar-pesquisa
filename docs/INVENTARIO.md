# Inventário inicial

| Item | Evidência | Estado |
|---|---|---|
| Dados históricos reais | Eduardo informou que eram obtidos online da ISEQ | Fonte identificada; conteúdo não acessado nesta entrega |
| Sensores/casos | Um na escola e outro no ambiente hospitalar | Confirmado na conversa; IDs/modelos/metadados pendentes |
| Arquivos locais | Busca por arquivos relacionados no projeto/Downloads/Codex | Nenhuma série histórica real localizada |
| TCC | PDF fornecido e analisado anteriormente | Antecedente, sem comprovar identidade com sensores atuais |
| Beta | Repositório público `edukarnopp3/edukarnopp3.github.io` | Snapshot de leitura SHA `bd1bece6193b05f84d5233cd7b1d033ce733155e` |
| Entrada online | API `/api/health`, `/api/auth/iseq/login`, `/api/iseq/equipment`, `/api/iseq/jobs`, contagens/cache e paginação | Contrato inspecionado e simulado na 0.1.3; health real expirou/mostrou inicialização Render; autenticação real pendente |
| Formatos | Aba `Dados brutos` ampla e `Dados` longa ISEQ | Adaptadores implementados; unidade/timestamp devem ser confirmados |
| Interface beta | Página publicada aberta; entrada ISEQ confirmada visualmente | Telas analíticas autenticadas não foram acessadas |

O beta foi consultado para interoperabilidade e comportamento existente. Não se encontrou licença explícita na árvore consultada. O novo código analítico/interface foi escrito neste projeto; não foi incorporado o monólito do beta ou seu backend. Os tokens visuais do shell Nexo foram reaproveitados por pedido expresso do usuário, com fonte de origem no documento de design.

## Mudanças justificadas pela inspeção

Separar modo de arquivos do login; identificar sensor em cada registro; conservar duplicatas/conflitos; distinguir cobertura temporal de contagem de valores válidos; declarar a agregação dos cartões e gráficos; interromper linhas em lacunas; vincular referências à janela e ao escopo; conferir recursos efetivamente ativos, pois funções definidas no beta não estão todas ligadas à interface atual.

Fonte: https://github.com/edukarnopp3/edukarnopp3.github.io . A cópia de referência está fora do novo repositório, no workspace da conversa.
