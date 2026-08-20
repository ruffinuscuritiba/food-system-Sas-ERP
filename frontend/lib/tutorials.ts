// Lista de tutoriais em vídeo — YouTube (pode ser "não listado").
// Pra adicionar um novo: peça pro Claude com o link do YouTube + o nome do
// setor (ex: "Vendas Recorrentes") — ele adiciona um item aqui e sobe.
//
// youtubeId = o trecho depois de "v=" ou "youtu.be/" no link do vídeo.
// Ex: https://www.youtube.com/watch?v=dQw4w9WgXcQ -> youtubeId: "dQw4w9WgXcQ"

export interface Tutorial {
  id: string;
  title: string;
  youtubeId: string;
  description?: string;
}

export const TUTORIALS: Tutorial[] = [
  // Exemplo de teste (link já existente no cardápio da Ruffinu's) — trocar
  // pelo primeiro tutorial real de configuração assim que gravado.
  { id: "exemplo-calzone", title: "Exemplo (vídeo de teste)", youtubeId: "65ddgCn5OG4", description: "Vídeo de exemplo — será substituído pelo primeiro tutorial real." },
];
