# Conciliador Domínio

Robô que roda sozinho no computador do escritório: lê o **razão** exportado pelo Domínio e os
**extratos bancários (OFX)**, faz a conciliação e grava o **arquivo TXT de lançamentos** pronto para o
Domínio importar, além dos relatórios de pendências. Uma pasta por empresa (CNPJ), quantas empresas quiser.

## O que ele faz

| Conciliação | Como |
|---|---|
| **Bancária** | Cada movimento do extrato é procurado na conta contábil do banco (mesmo valor, data com até `dateWindowDays` dias de diferença). O que falta na contabilidade vira lançamento: a contrapartida vem da primeira regra (`rules`) que casar com o histórico; sem regra, vai para a conta transitória (`transitAccount`). Confere o saldo final com o do banco. |
| **Fornecedores, clientes e demais contas patrimoniais** | Em cada conta, casa débitos com créditos (pelo nº do documento no histórico e depois por valor, incluindo o saldo anterior) e lista o que sobrou em aberto: a composição do saldo. Aponta itens parados há mais de `staleDays` dias e contas com saldo invertido. |

Nunca gera o mesmo movimento duas vezes (guarda em `estado/` o que já enviou) e nunca estorna ou apaga
nada: lançamento que está na contabilidade e não está no extrato só é apontado em pendências.

## Pastas

```
dados/
  empresas/<CNPJ>.json     configuração da empresa (modelo em exemplo/empresas/)
  entrada/<CNPJ>/          chegam aqui: razão (.xlsx ou .csv) e extratos (.ofx)
  saida/<CNPJ>/            lancamentos_*.txt (importar no Domínio), pendencias_*.csv, composicao_*.csv
  saida/resumo_*.json      resultado de cada execução, por empresa
  processados/<CNPJ>/      arquivos de entrada já usados
  estado/                  controle do que já foi gerado
```

A empresa só é processada quando há um razão na pasta de entrada; extrato sem razão fica esperando.

## Instalar e rodar

Precisa do [Node.js](https://nodejs.org) 20 ou mais novo.

```bash
cd conciliador
npm install
npm run executar -- C:\Conciliador\dados          # roda uma vez
npm run executar -- C:\Conciliador\dados --vigiar 15   # fica rodando, a cada 15 minutos
npm test
```

Para rodar sem ninguém abrir: Agendador de Tarefas do Windows > Criar Tarefa > disparador "Ao iniciar" >
ação `npm` com argumentos `run vigiar --prefix C:\caminho\conciliador -- C:\Conciliador\dados`.

## Ligando com o Domínio Web

O Domínio não tem API para lançamentos contábeis (a API do Onvio só recebe notas fiscais e baixas de
parcelas). A troca é por arquivo:

1. **Saída do Domínio (automática).** Em Contabilidade, crie uma Rotina Automática
   (Arquivos > Rotinas Automáticas) gerando o **Razão em Excel (xlsx)** e agende em
   Movimentos > Rotinas Automáticas, gravando em `M:\...\entrada\<CNPJ>\` (no Domínio Web o disco local
   aparece como `M:`). O suporte da Domínio recomenda agendar para até 1h30 depois do último uso, porque a
   sessão do Domínio Web cai por inatividade.
2. **Extratos.** Salve os OFX na mesma pasta `entrada/<CNPJ>/`.
3. **Entrada no Domínio.** O TXT sai no "Leiaute Domínio Sistemas com Separador" (registros 0000, 6000 e
   6100) e entra por Utilitários > Importação > Importação Padrão > Lançamentos Contábeis em Lote.
   **Este é o único passo que ainda não é automático**: o Domínio Web não oferece importação agendada
   nem por API, então hoje alguém precisa clicar em importar (ou um robô de tela precisa fazer isso).

## Antes de usar em produção

- **Valide o leiaute com uma empresa de teste.** O formato do razão em xlsx e a ordem dos campos do
  registro 6100 foram implementados a partir da documentação pública, sem um arquivo real do seu Domínio
  para conferir. Importe o primeiro TXT numa empresa de teste e confira antes de liberar para a carteira.
- **Conta transitória.** Tudo que não tem regra entra na contabilidade do cliente na conta
  `transitAccount`. Acompanhe o saldo dela em `pendencias_*.csv` (tipo `sem_regra`) e vá criando regras.
- As contas usam o **código reduzido** do Domínio.
