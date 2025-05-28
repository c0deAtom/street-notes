'use client';

import { NoteCard } from '@/components/NoteCard';

interface Note {
  id: string;
  title: string;
  content: string | null;
  highlights: { word: string }[];
}

interface NoteContentProps {
  selectedNote: Note | null;
  onDelete: (id: string) => void;
  onUpdate: (id: string, content: string, highlights: { word: string }[]) => void;
}

export function NoteContent({ selectedNote, onDelete, onUpdate }: NoteContentProps) {
  return (
    <div className="flex-1 p-4 overflow-auto">
      {selectedNote ? (
        <NoteCard
          note={selectedNote}
          onDelete={onDelete}
          onUpdate={onUpdate}
        />
      ) : (
        <div className="h-full flex items-center justify-center text-muted-foreground">
          Select a note to view its details
        </div>
      )}
    </div>
  );
} 