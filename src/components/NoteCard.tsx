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
  onUpdate: (id: string, content: string, highlights: Highlight[], title: string) => void;
  isEditing?: boolean;
}

export function NoteCard({ note, onDelete, onUpdate, isEditing: initialIsEditing = false }: NoteCardProps) {
  const [isEditing, setIsEditing] = useState(initialIsEditing);
  const [highlightedWords, setHighlightedWords] = useState<Set<string>>(new Set());
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [highlightTimeout, setHighlightTimeout] = useState<NodeJS.Timeout | null>(null);

  // Update isEditing state when prop changes
  useEffect(() => {
    setIsEditing(initialIsEditing);
  }, [initialIsEditing]);

  const handleMouseDown = (word: string, noteId: string) => {
    // Clear any existing timeout
    if (highlightTimeout) {
      clearTimeout(highlightTimeout);
    }
    
    // Set new timeout for 200ms
    const timeout = setTimeout(() => {
      setHighlightedWords(prev => new Set([...prev, word]));
      setSelectedNoteId(noteId);
    }, 200);
    
    setHighlightTimeout(timeout);
  };

  const handleMouseUp = async () => {
    // Clear the timeout if mouse is released before 200ms
    if (highlightTimeout) {
      clearTimeout(highlightTimeout);
      setHighlightTimeout(null);
    }

    if (highlightedWords.size > 0 && selectedNoteId) {
      const currentHighlights = new Set(note.highlights.map(h => h.word));
      const newHighlights = new Set<Highlight>();

      // Process each highlighted word
      highlightedWords.forEach(word => {
        if (currentHighlights.has(word)) {
          // Remove highlight if word is already highlighted
          currentHighlights.delete(word);
        } else {
          // Add highlight if word is not highlighted
          newHighlights.add({ word });
        }
      });

      // Combine remaining current highlights with new highlights
      const updatedHighlights = [
        ...Array.from(currentHighlights).map(word => ({ word })),
        ...Array.from(newHighlights)
      ];

      onUpdate(selectedNoteId, note.content || '', updatedHighlights, note.title);
      setHighlightedWords(new Set());
      setSelectedNoteId(null);
    }
  };

  const handleMouseLeave = () => {
    // Clear the timeout if mouse leaves before 200ms
    if (highlightTimeout) {
      clearTimeout(highlightTimeout);
      setHighlightTimeout(null);
    }
    setHighlightedWords(new Set());
    setSelectedNoteId(null);
  };

  const handleSave = (id: string, title: string, content: string) => {
    const updatedHighlights = note.highlights.filter(highlight => 
      content.includes(highlight.word)
    );
    onUpdate(id, content, updatedHighlights, title);
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
      <CardContent onMouseLeave={handleMouseLeave}>
        <p>
          {note.content?.split(' ').map((word, index) => (
            <span
              key={index}
              onMouseDown={() => handleMouseDown(word, note.id)}
              onMouseUp={handleMouseUp}
              style={{ 
                cursor: 'pointer', 
                backgroundColor: note.highlights.some(h => h.word === word) ? 'yellow' : 'transparent',
                opacity: highlightedWords.has(word) ? 0.7 : 1
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