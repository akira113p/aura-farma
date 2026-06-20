import { Stat } from 'frontend';

export const Faturamento = () => (
  <Stat label="Faturamento do dia" value="R$ 1.840,00" delta={12.4} />
);

export const LucroNeutro = () => (
  <Stat label="Lucro" value="R$ 552,00" delta={0.2} />
);

export const VendasNegativo = () => (
  <Stat label="Vendas" value="38 itens" delta={-5.8} />
);

export const SemDelta = () => (
  <Stat label="Ticket médio" value="R$ 48,42" sub="últimos 30 dias" />
);
