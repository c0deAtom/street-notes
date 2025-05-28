'use client'

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EditNote } from '@/components/EditNote';

interface Highlight {
  word: string;
}

interface Note {
  id: string;
  title: string;
  content: string | null;
  highlights: Highlight[];
}

interface NoteCardProps {
  note: Note;
  onDelete: (id: string) => void;
  onUpdate: (id: string, content: string, highlights: Highlight[]) => void;
  isEditing?: boolean;
}

export function NoteCard({ note, onDelete, onUpdate, isEditing: initialIsEditing = false }: NoteCardProps) {
  const [isEditing, setIsEditing] = useState(initialIsEditing);
  const [highlightedWord, setHighlightedWord] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  // Update isEditing state when prop changes
  useEffect(() => {
    setIsEditing(initialIsEditing);
  }, [initialIsEditing]);

  const handleMouseDown = (word: string, noteId: string) => {
    setHighlightedWord(word);
    setSelectedNoteId(noteId);
  };

  const handleMouseUp = async () => {
    if (highlightedWord && selectedNoteId) {
      const newHighlight: Highlight = { word: highlightedWord };
      onUpdate(selectedNoteId, note.content || '', [...note.highlights, newHighlight]);
      setHighlightedWord(null);
      setSelectedNoteId(null);
    }
  };

  const handleSave = (id: string, title: string, content: string) => {
    const updatedHighlights = note.highlights.filter(highlight => 
      content.includes(highlight.word)
    );
    onUpdate(id, content, updatedHighlights);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <EditNote
        note={note}
        onSave={handleSave}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle><div className='flex justify-between items-center'>{note.title}   <div className="flex gap-2 ">
          <Button variant="destructive" onClick={() => onDelete(note.id)}>
            Delete
          </Button>
          <Button onClick={() => setIsEditing(true)}>Edit</Button>
        </div></div></CardTitle>
        
      </CardHeader>
      <CardContent>
        <p>
          {note.content?.split(' ').map((word, index) => (
            <span
              key={index}
              onMouseDown={() => handleMouseDown(word, note.id)}
              onMouseUp={handleMouseUp}
              style={{ 
                cursor: 'pointer', 
                backgroundColor: note.highlights.some(h => h.word === word) ? 'yellow' : 'transparent' 
              }}
            >
              {word}{' '}
            </span>
          ))}
        </p>
        <p className="mt-2">
          <strong>Highlights:</strong> {note.highlights.map(h => h.word).join(', ')}
        </p>
      
      </CardContent>
    </Card>
  );
} 