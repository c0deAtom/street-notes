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
        <CardTitle>Edit Note</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="title" className="text-sm font-medium">
            Title
          </label>
          <Input
            id="title"
            value={title}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
            placeholder="Enter note title"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="content" className="text-sm font-medium">
            Content
          </label>
          <Textarea
            id="content"
            value={content}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
            placeholder="Enter note content"
            className="min-h-[200px]"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 