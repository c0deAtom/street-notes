'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Image from "next/image";

interface Note {
  id: string;
  title: string;
  content: string | null;
  highlights: string[];
}

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [highlightedWord, setHighlightedWord] = useState<string | null>(null);

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    const res = await fetch('/api/notes');
    const data = await res.json();
    setNotes(data);
  };

  const addNote = async () => {
    await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content }),
    });
    setTitle('');
    setContent('');
    fetchNotes();
  };

  const deleteNote = async (id: string) => {
    await fetch('/api/notes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    fetchNotes();
  };

  const handleMouseDown = (word: string) => {
    setHighlightedWord(word);
  };

  const handleMouseUp = async () => {
    if (highlightedWord) {
      const noteId = notes[0]?.id; // Assuming you want to save to the first note
      if (noteId) {
        await fetch('/api/notes', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: noteId, highlights: [...notes[0].highlights, highlightedWord] }),
        });
        fetchNotes();
      }
      setHighlightedWord(null);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Notes</h1>
      <div className="mb-4">
        <Input
          placeholder="Title"
          value={title}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
          className="mb-2"
        />
        <Input
          placeholder="Content"
          value={content}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContent(e.target.value)}
          className="mb-2"
        />
        <Button onClick={addNote}>Add Note</Button>
      </div>
      <div className="grid gap-4">
        {notes.map((note) => (
          <Card key={note.id}>
            <CardHeader>
              <CardTitle>{note.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{note.content}</p>
              <p className="mt-2">
                <strong>Highlights:</strong> {note.highlights.join(', ')}
              </p>
              <Button variant="destructive" onClick={() => deleteNote(note.id)}>
                Delete
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-4">
        <p>Click and hold to highlight a word:</p>
        <p onMouseDown={() => handleMouseDown('example')} onMouseUp={handleMouseUp}>
          This is an example sentence.
        </p>
      </div>
    </div>
  );
}
