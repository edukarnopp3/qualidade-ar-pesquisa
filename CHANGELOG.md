# Histórico

## Auditoria funcional — 08/10/2026

Auditoria multiagente da versão 0.1.1: 26 famílias de falhas reproduzidas e documentadas, com gabaritos, scripts sintéticos, capturas e ordem de correção em `audits/2026-10-08/`. Os 24 testes anteriores continuam aprovados, mas não cobriam essas falhas. Código de produção preservado nesta entrega documental; não constitui lançamento de uma versão corrigida.

## 0.1.1 — 08/10/2026

Corrigida a chamada do `fetch` nativo no conector ISEQ. A função estava armazenada e chamada como método do cliente, recebendo a instância como contexto; no navegador isso produzia `Illegal invocation` antes de enviar a requisição. O transporte agora mantém o contexto global correto. Atualizada a versão visível e registrada a correção em docs/EXECUCAO.md.

## 0.1.0 — 08/10/2026

Primeira implementação do plano aprovado. Código autoral separado do beta; análise local por workers; identificação de casos/sensores; importador amplo/longo; qualidade e decisões; gráficos com lacunas; regras explícitas; PDF/tabelas/pacotes; temas Nexo; conector histórico ISEQ em memória; demonstrações sintéticas; testes e build.

Verificações e limites em docs/EXECUCAO.md. Publicação no GitHub Pages concluída e conferida no navegador em 08/10/2026. Dados reais, calibração, revisão de referências e avaliação acadêmica não foram realizados.
