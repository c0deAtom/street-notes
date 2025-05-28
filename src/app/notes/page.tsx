'use client';

import { useState, useEffect } from 'react';

import { Sidebar } from '@/components/Sidebar';
import { NoteContent } from '@/components/NoteContent';

interface Highlight {
  word: string;
}

interface Note {
  id: string;
  title: string;
  content: string | null;
  highlights: Highlight[];
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  useEffect(() => {
    fetchNotes();
  }, []);

  useEffect(() => {
    if (selectedNote) {
      const updatedNote = notes.find(note => note.id === selectedNote.id);
      if (updatedNote) {
        setSelectedNote(updatedNote);
      }
    }
  }, [notes]);

  const fetchNotes = async () => {
    const res = await fetch('/api/notes');
    const data = await res.json();
    setNotes(data);
  };

  const createBlankNote = async () => {
    const response = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Note', content: '' }),
    });
    const newNote = await response.json();
    setNotes(prevNotes => [newNote, ...prevNotes]);
    setSelectedNote(newNote);
    setTitle(newNote.title);
    setContent(newNote.content || '');
    setIsAddingNote(true);
  };

  const updateNote = async (id: string, content: string, highlights: Highlight[]) => {
    const response = await fetch('/api/notes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, content, highlights }),
    });
    const updatedNote = await response.json();
    setNotes(prevNotes => 
      prevNotes.map(note => 
        note.id === id ? updatedNote : note
      )
    );
  };

  const deleteNote = async (id: string) => {
    await fetch('/api/notes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setNotes(prevNotes => prevNotes.filter(note => note.id !== id));
    if (selectedNote?.id === id) {
      setSelectedNote(null);
    }
  };

  return (
    <div className="h-screen flex relative">
      <Sidebar
        notes={notes}
        selectedNote={selectedNote}
        onNoteSelect={setSelectedNote}
        onAddNote={createBlankNote}
      />
      <div className="flex-1 flex flex-col h-full overflow-hidden ml-16">
       
        <NoteContent
          selectedNote={selectedNote}
          onDelete={deleteNote}
          onUpdate={updateNote}
        />
      </div>
    </div>
  );
} 