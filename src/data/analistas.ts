export type Analista = {
  id: string;
  nome: string;
  data_entrada: string;
  data_saida: string | null;
  ativo: boolean;
};

export const analistas: Analista[] = [
  { id: "analista_01", nome: "Carolina Baratz Weinberg", data_entrada: "2020-01-01", data_saida: null, ativo: true },
  { id: "analista_02", nome: "Diogo Vilaça Teixeira", data_entrada: "2020-01-01", data_saida: null, ativo: true },
  { id: "analista_03", nome: "Arthur Gandra de Andrade", data_entrada: "2020-01-01", data_saida: null, ativo: true },
  { id: "analista_04", nome: "Ennio Ferreira de Moraes Júnior", data_entrada: "2020-01-01", data_saida: null, ativo: true },
  { id: "analista_05", nome: "Paulo Marcelo Furlan de Melo", data_entrada: "2020-01-01", data_saida: null, ativo: true },
  { id: "analista_06", nome: "Victor Alves do Espírito Santo", data_entrada: "2020-01-01", data_saida: null, ativo: true },
  { id: "analista_07", nome: "Rafael Zitti", data_entrada: "2020-01-01", data_saida: null, ativo: true },
  { id: "analista_08", nome: "Luca Lima", data_entrada: "2020-01-01", data_saida: null, ativo: true },
  { id: "analista_09", nome: "Laura Nogueira", data_entrada: "2020-01-01", data_saida: null, ativo: true },
  { id: "analista_10", nome: "Ighor Fonseca", data_entrada: "2020-01-01", data_saida: null, ativo: true },
  { id: "analista_11", nome: "Juan Avelar", data_entrada: "2020-01-01", data_saida: "2024-07-31", ativo: false },
  { id: "analista_12", nome: "Daniel Almeida", data_entrada: "2020-01-01", data_saida: "2024-07-31", ativo: false },
  { id: "analista_13", nome: "Gabriel Batista", data_entrada: "2020-01-01", data_saida: "2024-07-31", ativo: false },
  { id: "analista_14", nome: "Lucas Costa", data_entrada: "2020-01-01", data_saida: "2024-07-31", ativo: false },
  { id: "analista_15", nome: "Pedro Soares", data_entrada: "2020-01-01", data_saida: "2024-07-31", ativo: false },
  { id: "analista_16", nome: "Marcos Brito", data_entrada: "2020-01-01", data_saida: "2024-07-31", ativo: false },
  { id: "analista_17", nome: "Rafael Botelho", data_entrada: "2020-01-01", data_saida: "2024-07-31", ativo: false },
  { id: "analista_18", nome: "Matheus Triginelli", data_entrada: "2020-01-01", data_saida: "2024-07-31", ativo: false },
];
