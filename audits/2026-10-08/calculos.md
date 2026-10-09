# Auditoria de cálculos e integridade científica

Data: 08/10/2026. Versão auditada: 0.1.1, HEAD `29ed8aaf6eba5cdcb9ee8867b7b82f1abcb272f0`.

## Escopo e evidência

Auditoria somente de leitura de produção. Foram examinados normalização, identidade do sensor, mistura de dados sintéticos, duplicatas, estatísticas, cobertura por slots nominais, intervalos observados, elegibilidade e referências com CO₂ externo. Nenhuma credencial, dado real ou critério normativo foi empregado. Excel 1904, CSV e pacotes são objeto do outro agente.

Reprodução executada com sucesso:

```powershell
node audits/2026-10-08/calculos/reproducao.mjs
```

Saída: **6 bugs reproduzidos e 9 controles positivos aprovados**. O script importa o núcleo real de produção e executa as funções/handlers reais `importDialog`, `ruleDialog` e `setActive` extraídos de `src/main.js`; somente DOM, renderização, toast e transporte para worker são simulados. É uma reprodução funcional das decisões dos handlers, não um teste completo de navegador. Todos os asserts confirmam explicitamente o comportamento observado no código auditado. Os resultados completos estão em `calculos/resultados.json`.

Essa auditoria confirma os achados abaixo dentro do escopo exercitado. Não constitui prova de ausência de outros defeitos nem validação metrológica dos sensores.

## Achados confirmados

### CALC-01 — P1 — Diferença de CO₂ mistura ppm externo com outra unidade interna

- **Código:** `src/core.js:121-123`; rótulo da entrada externa em `src/main.js:112`.
- **Reprodução:** hora completa com 60 leituras internas de `600000 ppb`; unidade do caso e da regra confirmadas como `ppb`; CO₂ externo preenchido como `400 ppm`, conforme rótulo real do formulário; limiar artificial `200000 ppb`.
- **Esperado:** converter `400 ppm` para `400000 ppb`, obter diferença `200000 ppb` e classificar `ate_referencia`, porque o limite é estritamente ultrapassado somente quando `valor > limiar`. Também seria aceitável impedir a comparação quando a conversão não estivesse implementada/documentada.
- **Observado:** diferença `599600` e resultado `acima`, com elegibilidade `admissivel`. O código subtrai o número externo diretamente, sem sua unidade.
- **Impacto:** resultado interpretativo invertido apesar de unidades internas e da regra estarem confirmadas. A conversão usada no gabarito é relação entre unidades, não uma norma ambiental.
- **Correção sugerida:** representar valor/unidade/origem do contexto externo e converter explicitamente ou restringir com impedimento fundamentado às unidades suportadas. Proibir a subtração de grandezas incompatíveis.

### CALC-02 — P1 — Concentração externa negativa produz comparação admissível

- **Código:** `src/main.js:112,115,117`; `src/core.js:121-123`.
- **Reprodução:** 60 leituras internas de `600 ppm`; externo `-200 ppm`; limiar artificial `700 ppm`.
- **Esperado:** recusar a concentração externa negativa e impedir comparação, preservando motivo.
- **Observado:** elegibilidade `admissivel`, diferença `800 ppm`, classificação `acima`. O handler real também aceitou `-200` sem erro; o input não possui `min` e a validação do núcleo só verifica se o número é finito.
- **Impacto:** concentração fisicamente inválida gera resultado ambiental aparentemente utilizável.
- **Correção sugerida:** validar domínio do contexto externo tanto na UI quanto no núcleo, para que arquivos reabertos ou chamadas independentes recebam a mesma proteção.

### CALC-03 — P1 — Identificador único do arquivo é substituído pelo digitado, permitindo misturar escola e hospital

- **Código:** `src/mappings.js:6`; `src/core.js:84`; `src/main.js:94-104`; a proteção de `src/importer.js:16` cobre apenas arquivos que contêm mais de um identificador.
- **Reprodução:** caso `SCHOOL`, ambiente `escola`, com uma leitura de `600 ppm`; arquivo com coluna reconhecida `sensor_id` contendo apenas `HOSPITAL` e leitura `900 ppm`; selecionar como destino o caso da escola. O identificador digitado/contextual é `SCHOOL`.
- **Esperado:** confrontar ID presente no arquivo com ID do caso e bloquear divergência ou exigir outro caso. Média da escola permanece `600 ppm`.
- **Observado:** importação aceita; leitura do hospital recebe `sensorId: SCHOOL`; caso permanece escola; média passa para `750 ppm`. O campo `mapping.sensor` é reconhecido, mas seu valor por linha não participa da normalização nem da validação da divergência. A validação atual compara somente o ID digitado com o ID do caso.
- **Impacto:** dados de ambientes distintos podem ser unidos, alterar média/duplicatas/cobertura e receber referências de escopo incorreto. Os bytes originais permanecem preservados, mas a identidade usada pelo motor foi alterada sem uma decisão específica registrada.
- **Correção sugerida:** extrair e validar identidade de origem; preservar `originalSensorId`; quando houver alteração de identificação, exigir motivo explícito. Não permitir união de sensores distintos em um caso de sensor único.

### CALC-04 — P1 — Adicionar arquivo sintético a caso real descarta a marca de demonstração

- **Código:** `src/main.js:89,95,98,101-105`; filtro de destinos reais no mesmo formulário, linha 89.
- **Reprodução:** destino é caso real já existente. Arquivo recebido tem `pending.synthetic: true`; formulário contém checkbox sintético marcado e a submissão mantém `synthetic: on`.
- **Esperado:** impedir mistura ou indicar explicitamente caso/leituras/fontes mistas; jamais apresentar dados sintéticos como observações reais sem marcação.
- **Observado:** o handler adiciona a fonte e as leituras; `dataset.synthetic` continua `false`; a fonte não recebe campo `synthetic`; a média real do fixture passa de `600` a `750 ppm`. `Boolean(data.get('synthetic'))` só é usado na criação de um caso novo.
- **Impacto:** entrada de demonstração participa da série classificada como histórica real e pode receber regras reais. A proteção contra aplicar regra sintética em dado real não resolve a inversão: dado sintético é incorporado ao caso real.
- **Correção sugerida:** bloquear esse destino ou registrar natureza por fonte/observação e definir política explícita para casos mistos. A marca informada pelo importador e confirmada pelo usuário precisa acompanhar a observação e a execução.

### CALC-05 — P2 — Contexto de CO₂ externo é global, pode mudar outra regra e desaparece ao alternar casos

- **Código:** `src/main.js:33-38,116-117`; seleção de regra preserva o mesmo config em `src/main.js:173`.
- **Reprodução 1:** cadastrar regra A com externo `400 ppm`, interno `600 ppm` e limiar artificial `150 ppm`: diferença `200`, resultado `acima`. Cadastrar regra B com externo `500 ppm`; reaplicar regra A sem editar A.
- **Observado 1:** regra A agora usa diferença `100` e resultado `ate_referencia`. As regras não armazenam contexto externo; cadastrar B grava seu valor somente em `state.config.outdoorCo2`.
- **Reprodução 2:** depois de informar externo, alternar escola → hospital → escola e selecionar novamente a regra de diferença.
- **Esperado:** contexto externo documentado pertença explicitamente ao caso/execução, ou seja solicitado de modo visível ao aplicar a regra; alterações não devem afetar outra referência de maneira implícita. Retornar ao caso deve permitir recuperar/revisar seu contexto.
- **Observado 2:** `setActive` redefine o valor para `null`; comparação fica `contexto_pendente`. Não existe campo de edição desse contexto na análise; o único input está no cadastro de uma nova referência.
- **Impacto:** fluxo de comparação perde uma condição já fornecida; o usuário precisa cadastrar outra referência para repor o valor, e diferentes critérios podem usar o último contexto informado sem mostrar esse valor no seletor. Execuções já arquivadas preservam sua cópia do config; não foi afirmado que resultados arquivados sejam sobrescritos.
- **Correção sugerida:** contexto externo editável e documentado por caso/recorte, com unidade, fonte e período de validade. Registrar alterações na nova execução. Uma referência descreve o critério; o dado externo usado precisa ser escolhido/mostrado junto da execução.
- **Complemento:** a auditoria de interface do agente coordenador reproduz a troca de caso no navegador e pode acrescentar screenshot/contagem de janelas ao relatório consolidado.

### CALC-06 — P3 — Soma de números finitos extremos pode gerar estatísticas não finitas

- **Código:** `src/core.js:54-59`; soma do perfil em `src/core.js:154-155` usa estratégia semelhante.
- **Reprodução:** `stats([1e308, 1e308])`.
- **Esperado:** média `1e308`, desvio padrão `0`, ou rejeição fundamentada de grandeza extrema antes de exportar.
- **Observado:** média `Infinity`, desvio padrão `Infinity`; `JSON.stringify` transforma esses dois campos em `null`. Os valores de entrada são finitos e passam pela filtragem existente.
- **Impacto:** robustez numérica e fidelidade de saída em arquivos extremos/corrompidos. **Não representa medições ambientais plausíveis nem falha observada em dados reais.** Prioridade inferior às falhas de identidade, mistura e CO₂ externo.
- **Correção sugerida:** validação de resultados finitos e algoritmos numericamente estáveis; rejeitar/registrar impossibilidade numérica em vez de deixar não finitos virarem nulos na serialização.

## Controles que funcionaram no escopo exercitado

Os seguintes controles tiveram assert independente e passaram:

1. Estatísticas de `[10,20,30,40]`: média/mediana `25`, P95 `38,5`, desvio padrão populacional `sqrt(125)`.
2. Duplicata idêntica conserva as duas observações e usa uma.
3. Duplicata conflitante exclui as duas; observações do mesmo horário de sensores já corretamente identificados como distintos não conflitam.
4. 30 leituras em slots de 60 segundos numa hora: cobertura `30/60 = 50%`; intervalo mediano observado `60 s`; comparação com cobertura mínima artificial de 100% impedida.
5. Doze leituras dentro de um slot não elevam cobertura acima de `1/60`.
6. Janela vazia é preservada com média `null`; recorte parcial recebe `janela_parcial`.
7. Unidade incompatível não entra na média; unidade, método e escopo pendentes impedem comparação.
8. Fração acima usa somente as janelas elegíveis no denominador.
9. Perfil e histograma conservam a contagem e usam a mesma base das estatísticas.

## Limitações metodológicas, sem classificá-las como bugs novos

- Média aritmética de leituras em amostragem irregular é uma escolha explicitamente documentada; não é média ponderada pelo tempo ou estimativa de exposição.
- A cobertura é calculada por slots reancorados em cada janela e depois somada. Quando a frequência não divide a janela, o `ceil` por janela pode fazer a cobertura global depender da agregação. A semântica está documentada como particionamento por janela; recomenda-se análise de sensibilidade, sem declarar um resultado obrigatório ausente da especificação.
- Frequência nominal constante por caso e offset fixo, sem reconstrução de horário de verão, já estão documentados como limitações.
- Não foram confirmadas fontes normativas, calibração, unidades metrológicas de COVs/NOₓ nem login real. O catálogo artificial usado nos testes não deve ser reutilizado como referência ambiental.

## Critério para liberar uso científico

Resolver CALC-01 a CALC-04 e exercitar os respectivos cenários de regressão antes de tratar comparações como evidência do estudo. Resolver CALC-05 antes de validar o fluxo recorrente de CO₂ externo. O fluxo descritivo teve controles numéricos usuais aprovados, mas a identidade de origem e a marca sintética devem estar corretas para que uma média matematicamente correta descreva o caso certo.
