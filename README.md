# Qualidade do ar — análise histórica

Ferramenta de pesquisa de Eduardo para análise histórica rastreável de sensores em uma escola e em ambiente hospitalar. Versão **0.1.3**, com diagnóstico de tempos e progresso/cache ISEQ, após as correções da auditoria funcional. Avaliação científica e aplicação com dados reais pendentes.

**[Abrir a aplicação](https://edukarnopp3.github.io/qualidade-ar-pesquisa/)** · [Estado da entrega](docs/EXECUCAO.md) · [Plano de pesquisa e software](docs/pesquisa/PLANO.md)

## Executar

Requer Node.js 22.12 ou superior. No Windows, abra `Iniciar.cmd`, ou execute:

```powershell
npm ci
npm run dev
```

Acesse **http://127.0.0.1:8765/**. O site carrega o programa e as bibliotecas da própria aplicação. Os arquivos locais são processados por Web Workers no navegador.

## Funções implementadas

- Importação local de XLSX/XLS/CSV, com prévia, escolha de aba e confirmação de colunas, sensor, ambiente, unidade e fuso.
- Casos independentes, com identificação de sensor na chave de duplicação.
- Preservação das entradas, rejeições, conflitos, marcações e decisões do pesquisador.
- Médias horárias/diárias, cobertura de slots temporais, série com lacunas, perfil horário, distribuição e tabela acessível.
- Catálogo de referências cadastradas pelo pesquisador, com bloqueio por escopo, unidade, método, janela, frequência e suficiência.
- PDF local, Excel/CSV e pacotes completos/compartilháveis, reabertura preservada e reprocessamento explícito.
- Temas claro/escuro e sistema visual adaptado do shell Nexo aprovado.
- Conector opcional ISEQ: verificação prévia do serviço, autenticação, lista de sensores, histórico por período, progresso/cache, paginação, cancelamento e diagnóstico transitório sem credenciais ou leituras.

O aplicativo inicia vazio. **Explorar demonstração** cria casos integralmente sintéticos. `examples/` contém planilhas sintéticas para exercitar a importação. O critério didático de 1.200 ppm e 75% é arbitrário e não representa norma ou recomendação de saúde.

## ISEQ

Eduardo confirmou que os históricos usados antes eram obtidos online da ISEQ. O conector usa o contrato HTTP do backend existente e fica inativo até a ação explícita de login. Usuário/senha são enviados somente ao backend escolhido no formulário; a sessão permanece em memória. O backend herdado tem armazenamento próprio, conforme a sua documentação. A entrada online é uma exceção explícita ao modo de arquivos inteiramente local.

Não inclua credenciais no Git ou nos pacotes. Esta entrega testou o conector com respostas controladas, sem autenticação real. Disponibilidade, CORS e acesso aos dados reais dependem do serviço e da conta do usuário. A porta local 8765 coincide com a origem permitida por padrão no backend do beta. GitHub Pages usa a mesma origem `https://edukarnopp3.github.io` do beta.

Entrega de desempenho e seus limites: [docs/ISEQ-0.1.3.md](docs/ISEQ-0.1.3.md). A rota pública do serviço real permaneceu sem resposta JSON na conferência; a autenticação e os tempos reais da ISEQ continuam pendentes. O [plano](docs/PLANO-DESEMPENHO-ISEQ.md) registra as decisões condicionadas às medições.

## Documentação

- [Execução, estado e pendências](docs/EXECUCAO.md)
- [Correções e evidências da versão 0.1.2](docs/CORRECOES-0.1.2.md)
- [Conexão, cache e diagnóstico ISEQ da versão 0.1.3](docs/ISEQ-0.1.3.md)
- [Plano integrado de pesquisa e software](docs/pesquisa/PLANO.md)
- [Método computacional](docs/METODO.md)
- [Interface e tokens Nexo](docs/DESIGN-SYSTEM.md)
- [Manual de uso](docs/MANUAL.md)
- [Inventário e origem do beta](docs/INVENTARIO.md)
- [Contrato dos pacotes](docs/PACOTES.md)
- [Histórico de alterações](CHANGELOG.md)
- [Dependências e licenças](THIRD_PARTY_NOTICES.md)

## Verificações

### Auditoria funcional de 08/10/2026

A auditoria multiagente da versão 0.1.1 confirmou **26 famílias de falhas**. Os achados foram corrigidos na **0.1.2**, com regressões automatizadas e conferência dos fluxos no navegador. Consulte a [matriz de correções e seus limites](docs/CORRECOES-0.1.2.md). O [relatório original](audits/2026-10-08/RELATORIO.md) e as [reproduções](audits/2026-10-08/REPRODUCAO.md) preservam o comportamento da versão auditada; seus scripts demonstram defeitos antigos e não são testes de aprovação da versão corrigida.

```powershell
npm test
npm run build
```

As verificações desta versão cobrem exemplos independentes pequenos, erros de importação, cobertura, comparação, integridade dos pacotes e contratos simulados do conector. Não validam a precisão física dos sensores nem substituem revisão das referências.

## Publicação

O projeto está publicado no [GitHub Pages](https://edukarnopp3.github.io/qualidade-ar-pesquisa/) com arquivos estáticos e base relativa. A automação em `.github/workflows/pages.yml` executa testes e build antes de publicar. A primeira versão pública foi conferida no navegador em 08/10/2026; registro e evidências em [docs/EXECUCAO.md](docs/EXECUCAO.md). O beta original permanece em outro repositório.

Nenhuma referência normativa vem ativa por padrão. Valores apresentados descrevem registros recebidos; interpretação ambiental depende de documentação, método e revisão adequada.
