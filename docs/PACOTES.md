# Contrato do pacote .aircase

ZIP com esquema 1: `manifest.json`, `case.json`, `execution.json`, `history.json`, instruções e, no completo, `inputs/<sourceId>.bin`.

O manifesto registra versão do esquema/software, data, modalidade e SHA-256 de cada componente. Fontes originais também têm hash conferido. Hash detecta alteração em relação ao manifesto; não equivale a assinatura, autenticidade ou autoria. O manifesto é parte do arquivo e não tem assinatura digital.

Completo: metadados, observações/decisões, arquivos originais, execução e últimas 30 execuções. Compartilhável: resultados agregados e metadados, com observações/arquivos de origem retirados. Esse pacote abre resultados, mas não recalcula. Metadados/valores agregados ainda devem ser revisados antes de compartilhar.

Reabertura verifica estrutura/hashes e exibe a execução arquivada. Recalcular exige ação explícita e entradas disponíveis, criando outro ID/data. Não existe migração automática de esquema diferente; incompatibilidade é informada. A preferência de tema é o único dado salvo em localStorage. Casos e sessões ISEQ não são salvos no navegador.
