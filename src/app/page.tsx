'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Image from "next/image";

interface Highlight {
  word: string;
}

interface Note {
  id: string;
  title: string;
  content: string | null;
  highlights: Highlight[];
}

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [highlightedWord, setHighlightedWord] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

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

  const handleMouseDown = (word: string, noteId: string) => {
    setHighlightedWord(word);
    setSelectedNoteId(noteId);
  };

  const handleMouseUp = async () => {
    if (highlightedWord && selectedNoteId) {
      const note = notes.find(n => n.id === selectedNoteId);
      if (note) {
        const newHighlight: Highlight = { word: highlightedWord };
        await fetch('/api/notes', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selectedNoteId, highlights: [...note.highlights, newHighlight] }),
        });
        fetchNotes();
      }
      setHighlightedWord(null);
      setSelectedNoteId(null);
    }
  };

  const startEditing = (note: Note) => {
    setEditingNoteId(note.id);
    setEditingContent(note.content || '');
  };

  const saveEdit = async () => {
    if (editingNoteId) {
      const note = notes.find(n => n.id === editingNoteId);
      if (note) {
        const updatedHighlights = note.highlights.filter(highlight => editingContent.includes(highlight.word));
        await fetch('/api/notes', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingNoteId, content: editingContent, highlights: updatedHighlights }),
        });
        setEditingNoteId(null);
        fetchNotes();
      }
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
                      style={{ cursor: 'pointer', backgroundColor: note.highlights.some(h => h.word === word) ? 'yellow' : 'transparent' }}
                    >
                      {word}{' '}
                    </span>
                  ))}
                </p>
              )}
              <p className="mt-2">
                <strong>Highlights:</strong> {note.highlights.map(h => h.word).join(', ')}
              </p>
              <Button variant="destructive" onClick={() => deleteNote(note.id)}>
                Delete
              </Button>
              <Button onClick={() => startEditing(note)}>Edit</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
