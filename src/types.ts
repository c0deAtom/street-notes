export interface Tile {
  id: string;
  title: string;
  content: string | null;
  position: number;
  noteId: string;
  highlights: any[];
  createdAt: Date;
}

export interface Note {
  id: string;
  title: string;
  content: string | null;
  highlights: { word: string }[];
  tiles: Tile[];
  createdAt: Date;
  position: number;
} 