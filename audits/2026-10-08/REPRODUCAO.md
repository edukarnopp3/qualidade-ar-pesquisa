# Reproduzir a auditoria 0.1.1

Executar na raiz do projeto com suas dependências instaladas. O código de referência é `29ed8aaf6eba5cdcb9ee8867b7b82f1abcb272f0`. Os scripts importam produção e, quando necessário, executam callbacks reais em um DOM simulado. Não fazem login real nem requisições externas.

```powershell
npm test
node audits/2026-10-08/iseq/repro.mjs
node audits/2026-10-08/calculos/reproducao.mjs
node audits/2026-10-08/arquivos/reproduzir.mjs
node audits/2026-10-08/arquivos/verificar-contratos.mjs
```

As sondagens foram construídas para **confirmar comportamentos defeituosos dessa versão**. Exit code zero confirma a reprodução/controles declarados; não é aprovação de uma versão corrigida. Ao corrigir, os gabaritos devem virar testes de regressão que exijam o resultado correto. Arquivos gerados são exclusivamente sintéticos.

## Interface

Em dois terminais locais:

```powershell
npm run dev
node audits/2026-10-08/ui/mock-backend.mjs
```

Abrir `http://127.0.0.1:8765/` em uma sessão isolada. Não usar credenciais reais nos cenários abaixo. Usuário sugerido: `auditoria-sintetica@example.invalid`; senha qualquer fictícia.

1. ISEQ sem resposta: no formulário, backend `http://127.0.0.1:8787/hang`; submeter e observar estado por ao menos 75 s. Fechar apenas o modal não aborta a requisição nessa versão.
2. ISEQ tardia: backend `/slow`; submeter, fechar login, abrir Referências → Cadastrar referência. Após 15 s o modal ISEQ substitui o cadastro.
3. ISEQ positiva: backend `/ok`; login lista AUDIT-DEVICE; período 01/10/2026 recebe duas leituras 500/700. Marcar a entrada como sintética antes de importar.
4. ISEQ erro estruturado: backend `/fail`; observar a mensagem genérica, em vez de `detail.message`.
5. Contexto externo: explorar demonstração, cadastrar critério artificial CO₂ em ppm, limiar 200, cobertura 75%, externo 400; confirmar condições e aplicar à escola. Alternar hospital/escola e reaplicar: contexto se perde.
6. Histórico: alterar frequência/nome em Arquivos e contexto; selecionar a execução anterior e conferir o contexto exibido/exportado.
7. Excel: importar `examples/escola-sintetica.xlsx`; preencher contexto; revisar um conflito; aplicar média diária; exportar os cinco tipos. Comparar ID/valores entre resultados e pacotes.
8. Compartilhável: reabrir, tentar editar nome, observar erro; fechar e voltar à análise. O nome alterado permanece, sem nova execução.
9. Celular: viewport 390 × 844; botão de pasta da barra superior fica sem texto ou nome semântico; verificar claro/escuro e retirar override ao terminar.

## Conferir os downloads da interface

Criar um JSON **local** com os caminhos dos cinco arquivos que você acabou de gerar. A chave `name` deve conter respectivamente `Baixar PDF`, `Baixar Excel`, `Baixar CSV`, `Salvar pacote completo`, `Salvar compartilhável`; `path` contém o caminho correspondente. Não usar dados institucionais.

```powershell
node audits/2026-10-08/ui/verificar-downloads.mjs C:/caminho/local/downloads-sinteticos.json
```

O verificador dessa rodada espera o caso do passo 7, com 7 janelas e 17676 observações, antes de remover originais no compartilhável. Confere igualdade entre Excel/CSV/pacotes e cabeçalho PDF; não substitui inspeção visual do PDF. Os caminhos locais do pesquisador não foram publicados.

Resultados e capturas registrados nesta rodada estão ao lado dos scripts e nos relatórios. Os logs do mock registram método/rota, descartando corpo e sessão. Encerrar o mock e o servidor de desenvolvimento ao terminar.
