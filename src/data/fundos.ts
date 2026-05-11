// Lista fixa de fundos da Butiá usada nos dropdowns de participação em assembleias.
// Edite esta lista conforme novos fundos forem incorporados.
export const FUNDOS_BUTIA = [
  'Butiá Fundamental FIA',
  'Butiá Excellence FIM',
  'Butiá TOP Long Bias FIM',
  'Butiá Debêntures Incentivadas FI-Infra',
  'Butiá Crédito Privado FIRF',
  'Butiá Previdência FIM',
] as const;

export type FundoButia = (typeof FUNDOS_BUTIA)[number];
