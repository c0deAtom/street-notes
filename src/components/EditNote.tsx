'use client';

import { useState, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Note {
  id: string;
  title: string;
  content: string | null;
  highlights: { word: string }[];
}

interface EditNoteProps {
  note: Note;
  onSave: (id: string, title: string, content: string) => void;
  onCancel: () => void;
}

export function EditNote({ note, onSave, onCancel }: EditNoteProps) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content || '');

  const handleSave = () => {
    onSave(note.id, title, content);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <div className='flex justify-between items-center'>
            <Input
              value={title}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
              placeholder="Enter note title"
              className="h-8 text-lg font-semibold"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                Save
              </Button>
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Textarea
            value={content}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
            placeholder="Enter note content"
            className="min-h-[200px] resize-none"
          />
          <p className="mt-2">
            <strong>Highlights:</strong> {note.highlights.map(h => h.word).join(', ')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
} 