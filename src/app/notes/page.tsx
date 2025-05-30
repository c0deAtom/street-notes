'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { NoteCard } from '@/components/NoteCard';

interface Highlight {
  word: string;
}

interface Tile {
  id: string;
  title: string;
  content: string | null;
  position: number;
}

interface Note {
  id: string;
  title: string;
  content: string | null;
  highlights: Highlight[];
  tiles: Tile[];
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isCreatingNote, setIsCreatingNote] = useState(false);

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
    // Prevent multiple simultaneous note creations
    if (isCreatingNote) return;
    
    try {
      setIsCreatingNote(true);
      // Fetch latest notes to ensure we have the most up-to-date list
      await fetchNotes();
      
      // Find the highest Untitled_X number in existing notes
      const untitledNotes = notes.filter(note => note.title.startsWith('Untitled_'));
      const numbers = untitledNotes.map(note => {
        const match = note.title.match(/Untitled_(\d+)/);
        return match ? parseInt(match[1]) : 0;
      });
      const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
      const newTitle = `Untitled_${nextNumber}`;

      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, content: '' }),
      });
      const newNote = await response.json();
      // Add isNew flag to the note
      const noteWithFlag = { ...newNote, isNew: true };
      setNotes(prevNotes => [noteWithFlag, ...prevNotes]);
      setSelectedNote(noteWithFlag);
      setTitle(newNote.title);
      setContent(newNote.content || '');
      setIsAddingNote(true);
    } finally {
      setIsCreatingNote(false);
    }
  };

  const updateNote = async (id: string, content: string, highlights: Highlight[], title: string) => {
    const response = await fetch('/api/notes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, content, highlights, title }),
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
    <div className="flex relative h-[calc(100vh-4rem)]">
      <Sidebar
        notes={notes}
        selectedNote={selectedNote}
        onNoteSelect={setSelectedNote}
        onAddNote={createBlankNote}
        onExpand={setIsSidebarExpanded}
      />
      <div 
        className={`flex-1 flex flex-col h-full overflow-hidden transition-all duration-300 ease-in-out ${
          isSidebarExpanded ? 'ml-64' : 'ml-16'
        }`}
      >
        {selectedNote ? (
          <div className="p-4 h-full overflow-auto">
            <NoteCard noteId={selectedNote.id} initialTiles={selectedNote.tiles || []} />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Select a note or create a new one
          </div>
        )}
      </div>
    </div>
  );
} 