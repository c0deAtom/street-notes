'use client';

import { useState, useEffect } from 'react';
import { NoteCard } from '@/components/NoteCard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { X } from 'lucide-react';

interface Note {
  id: string;
  title: string;
  content: string | null;
  highlights: { word: string }[];
  isNew?: boolean;
}

interface NoteContentProps {
  selectedNote: Note | null;
  onDelete: (id: string) => void;
  onUpdate: (id: string, content: string, highlights: { word: string }[], title: string) => void;
  onNoteSelect: (note: Note | null) => void;
}

export function NoteContent({ selectedNote, onDelete, onUpdate, onNoteSelect }: NoteContentProps) {
  const [isClient, setIsClient] = useState(false);
  const [openNotes, setOpenNotes] = useState<Note[]>([]);
  const [activeTab, setActiveTab] = useState<string>('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  // Set isClient to true after mount
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load from localStorage after mount
  useEffect(() => {
    if (isClient) {
      const savedNotes = localStorage.getItem('openNotes');
      const savedActiveTab = localStorage.getItem('activeTab');
      if (savedNotes) {
        setOpenNotes(JSON.parse(savedNotes));
      }
      if (savedActiveTab) {
        setActiveTab(savedActiveTab);
      }
    }
  }, [isClient]);

  // Save to localStorage whenever openNotes or activeTab changes
  useEffect(() => {
    if (isClient) {
      localStorage.setItem('openNotes', JSON.stringify(openNotes));
      localStorage.setItem('activeTab', activeTab);
    }
  }, [openNotes, activeTab, isClient]);

  // Handle note selection from sidebar
  useEffect(() => {
    if (selectedNote) {
      const existingNote = openNotes.find(note => note.id === selectedNote.id);
      if (existingNote) {
        // If note is already open, just focus on it
        setActiveTab(selectedNote.id);
        // Update the note content if it has changed
        setOpenNotes(prev => 
          prev.map(note => 
            note.id === selectedNote.id ? { ...selectedNote, isNew: false } : note
          )
        );
      } else {
        // If note is not open, add it to tabs
        setOpenNotes(prev => [...prev, { ...selectedNote, isNew: false }]);
        setActiveTab(selectedNote.id);
        // Only set edit mode if this is a newly created note
        if (selectedNote.isNew) {
          setEditingNoteId(selectedNote.id);
        }
      }
    }
  }, [selectedNote]);

  const handleCloseTab = (noteId: string) => {
    setOpenNotes(prev => prev.filter(note => note.id !== noteId));
    if (activeTab === noteId) {
      const remainingNotes = openNotes.filter(note => note.id !== noteId);
      if (remainingNotes.length > 0) {
        setActiveTab(remainingNotes[0].id);
        onNoteSelect(remainingNotes[0]);
      } else {
        setActiveTab('');
        onNoteSelect(null);
      }
    }
    if (editingNoteId === noteId) {
      setEditingNoteId(null);
    }
  };

  const handleDelete = (id: string) => {
    // Remove from open tabs
    setOpenNotes(prev => prev.filter(note => note.id !== id));
    // Update active tab if needed
    if (activeTab === id) {
      const remainingNotes = openNotes.filter(note => note.id !== id);
      if (remainingNotes.length > 0) {
        setActiveTab(remainingNotes[0].id);
        onNoteSelect(remainingNotes[0]);
      } else {
        setActiveTab('');
        onNoteSelect(null);
      }
    }
    if (editingNoteId === id) {
      setEditingNoteId(null);
    }
    // Call parent's onDelete
    onDelete(id);
  };

  const handleUpdate = (id: string, content: string, highlights: { word: string }[], title: string) => {
    // Update local state
    setOpenNotes(prev => 
      prev.map(note => 
        note.id === id 
          ? { ...note, content, highlights, title }
          : note
      )
    );
    // Call parent's onUpdate
    onUpdate(id, content, highlights, title);
    // Exit edit mode after update
    setEditingNoteId(null);
  };

  // Show loading state during SSR and initial client render
  if (!isClient) {
    return (
      <div className="flex-1 p-4 overflow-auto">
        <div className="h-full flex items-center justify-center text-muted-foreground">
          Loading...
        </div>
      </div>
    );
  }

  if (openNotes.length === 0) {
    return (
      <div className="flex-1 p-4 overflow-auto">
        <div className="h-full flex items-center justify-center text-muted-foreground">
          Select a note to view its details
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b px-4">
          <TabsList className="w-full justify-start">
            {openNotes.map((note) => (
              <TabsTrigger
                key={note.id}
                value={note.id}
                className="flex items-center gap-2 px-3"
              >
                {note.title}
                <div
                  role="button"
                  tabIndex={0}
                  className="h-4 w-4 p-0 hover:bg-muted rounded-sm flex items-center justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseTab(note.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation();
                      handleCloseTab(note.id);
                    }
                  }}
                >
                  <X className="h-3 w-3" />
                </div>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {openNotes.map((note) => (
          <TabsContent
            key={note.id}
            value={note.id}
            className="flex-1 overflow-auto p-4"
          >
            <NoteCard
              note={note}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
              isEditing={editingNoteId === note.id}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
} 