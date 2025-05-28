import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
}

export function NoteCard({ note, onDelete, onUpdate }: NoteCardProps) {
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [highlightedWord, setHighlightedWord] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

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

  const startEditing = () => {
    setEditingNoteId(note.id);
    setEditingContent(note.content || '');
  };

  const saveEdit = async () => {
    if (editingNoteId) {
      const updatedHighlights = note.highlights.filter(highlight => 
        editingContent.includes(highlight.word)
      );
      onUpdate(editingNoteId, editingContent, updatedHighlights);
      setEditingNoteId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{note.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {editingNoteId === note.id ? (
          <div>
            <Input
              value={editingContent}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingContent(e.target.value)}
              className="mb-2"
            />
            <Button onClick={saveEdit}>Save</Button>
          </div>
        ) : (
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
        )}
        <p className="mt-2">
          <strong>Highlights:</strong> {note.highlights.map(h => h.word).join(', ')}
        </p>
        <div className="flex gap-2 mt-4">
          <Button variant="destructive" onClick={() => onDelete(note.id)}>
            Delete
          </Button>
          <Button onClick={startEditing}>Edit</Button>
        </div>
      </CardContent>
    </Card>
  );
} 