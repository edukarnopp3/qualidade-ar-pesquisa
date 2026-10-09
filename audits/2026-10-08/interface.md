# Auditoria da interface e dos usos da ferramenta

Data local: 08/10/2026, America/Sao_Paulo. Software 0.1.1; código `29ed8aaf6eba5cdcb9ee8867b7b82f1abcb272f0`.

## Método

O agente coordenador operou a aplicação no navegador integrado do Codex, servida pelo Vite em 127.0.0.1:8765. O código é o mesmo commit auditado; a autenticação foi dirigida a um servidor controlado em 127.0.0.1:8787. Todas as entradas e contas são fictícias. Não foram usadas credenciais reais, históricos institucionais nem a captura do usuário como arquivo público.

O servidor controlado descarta os corpos das requisições e não registra senha/token. O roteiro produz estados sem resposta, resposta atrasada e histórico sintético válido. As capturas são desta auditoria, em `ui/`. Os artefatos baixados foram verificados no dispositivo.

## Falhas novas confirmadas

### UI-01 — P2 — Edição recusada modifica o caso antes de falhar

Código: `src/main.js:25-26`, `src/main.js:120-125`.

1. Importar o Excel sintético, salvar um pacote compartilhável e reabri-lo.
2. Em Arquivos e contexto, abrir Editar contexto e trocar o nome para `ALTERADO APÓS FALHA · auditoria`.
3. Acionar Salvar e criar nova execução.
4. O programa informa: `O pacote compartilhável permite visualizar resultados. Recupere os arquivos de entrada para recalcular.`.
5. Fechar o modal e abrir Análise temporal.

Esperado: uma operação recusada não modifica o caso nem sua identificação; edição que depende de originais deve ser impedida ou aplicada de modo transacional.

Observado: o novo nome permanece, mas a execução continua `d8e30b75-5cde-46f8-8584-ea07d5347be9`, criada antes da tentativa. O handler altera o objeto e as decisões antes de chamar `compute()`, que rejeita pela falta das entradas. A falha não desfaz essas alterações. Essa falha é distinta de ARQ-03: não depende de selecionar uma execução antiga; uma operação que não foi concluída já muda o contexto corrente.

Evidências: `ui/10-edicao-compartilhavel-falhou.jpg` e `ui/11-mudanca-persistiu-apos-falha.jpg`.

### UI-02 — P2 — Abrir análise perde o nome acessível no celular

Código: `src/main.js:44`, `src/styles.css:6`.

1. Abrir a aplicação em viewport de 390 × 844 px.
2. Inspecionar o botão de pasta da barra superior.

Esperado: o controle continua identificado como Abrir análise quando o texto visível é ocultado.

Observado: o snapshot semântico retorna um botão sem nome. O botão possui `innerText=''`, `aria-label=null` e `title=null`; seu rótulo `.button-text` tem largura/altura zero. O SVG está marcado como decorativo. A combinação retira o nome do controle para tecnologia assistiva. O menu móvel, ao contrário, recebe corretamente o nome Abrir navegação.

Evidência: `ui/12-mobile-dark.jpg` e os valores DOM registrados em `ui/observacoes.json`. A inspeção não constitui auditoria completa de acessibilidade nem certificação WCAG.

## Confirmações visuais de achados dos agentes

Estes itens complementam achados existentes e **não devem ser somados novamente**.

| Achado | Reprodução no navegador | Evidência |
|---|---|---|
| ISEQ-01 | Login controlado sem resposta permaneceu com submit desabilitado por 75 s; sem indicador, texto de erro ou cancelamento | `ui/04-login-bloqueado.jpg` |
| ISEQ-05 | Fechar login lento e abrir cadastro de referência; após resposta de 15 s, o seletor ISEQ substituiu o cadastro e apagou o formulário não salvo | `ui/06-formulario-antes-resposta.jpg`, `ui/07-resposta-tardia-troca-modal.jpg` |
| CALC-05 | Regra com externo 400 ppm tinha 163 janelas elegíveis; alternar hospital/escola e reaplicar deixou zero elegíveis e Contexto pendente | `ui/02-regra-externa-aplicada.jpg`, `ui/03-co2-externo-perdido.jpg` |
| ARQ-03 | Após alterar frequência de 300 para 600 s e nome, reabrir a primeira execução mantém sua cobertura de 97,27%, mas exibe frequência/nome atuais | `ui/05-historico-contexto-atual.jpg` |

## Controles positivos percorridos nesta auditoria

- Tela inicial e demonstração: dois casos separados, três gráficos, indicação sintética e tabela.
- Nove parâmetros no hospital sintético: seleção e gráficos renderizados, sem erros de console no trecho exercitado. Médias e rótulos em `ui/parametros.json`.
- XLSX: seleção de arquivo/aba, confirmação do contexto, qualidade, duplicatas e data impossível rejeitada com linha de origem.
- Revisão manual: uma leitura conflitante de 658 ppm incluída; a outra de 438 ppm continuou preservada e excluída.
- Média diária: sete janelas; 1962 leituras utilizadas, média 649,2915392456676 ppm, cobertura 0,9732142857142857.
- PDF, Excel, CSV e dois pacotes baixados. Excel/CSV/pacotes têm sete janelas e os mesmos valores/ID. O cabeçalho PDF é válido; essa verificação adicional não equivale a inspecionar visualmente todas as suas páginas.
- Completo reaberto: manteve ID, números e resultados; apresentou estado arquivado e recorte desabilitado.
- Compartilhável reaberto: mesmos agregados, zero observações normalizadas e recálculo indisponível.
- Login/histórico rápidos em servidor controlado: MAC `AUDIT-DEVICE`, nome e duas linhas chegaram ao formulário de importação. Isso também exercitou o `fetch` nativo corrigido em 0.1.1.
- Claro/escuro, desktop e 390 px sem transbordamento horizontal nos estados conferidos. Menu móvel abre/fecha; override de viewport foi retirado após a inspeção.

## Limites

Login real, CORS e disponibilidade atual do Render não foram confirmados. Não foram realizados benchmark de históricos institucionais, teste completo de todos os navegadores/dispositivos, avaliação com leitor de tela, auditoria automatizada de acessibilidade ou revisão metrológica/normativa. A carga inicial do Vite ficou vazia até o recarregamento após aquecer dependências; sem causa reproduzível independente, isso foi tratado como ocorrência do ambiente de desenvolvimento, não como bug confirmado da versão pública.

A auditoria documenta os defeitos reproduzidos e os caminhos percorridos; não garante ausência de outros bugs. Nenhuma correção de produção foi aplicada nesta rodada.
