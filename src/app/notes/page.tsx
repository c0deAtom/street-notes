'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { NoteCard } from '@/components/NoteCard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Navbar } from '@/components/Navbar';

interface Highlight {
  word: string;
}

interface Tile {
  id: string;
  title: string;
  content: string | null;
  position: number;
  noteId: string;
  highlights: any[];
  createdAt: Date;
}

interface Note {
  id: string;
  title: string;
  content: string | null;
  highlights: Highlight[];
  tiles: Tile[];
  createdAt: Date;
  position: number;
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [openTabs, setOpenTabs] = useState<Note[]>([]);
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);
  const { toast } = useToast();

  // Load saved tabs from localStorage on initial mount
  useEffect(() => {
    fetchNotes();
    const savedTabs = localStorage.getItem('openTabs');
    const savedActiveTab = localStorage.getItem('activeTab');
    
    if (savedTabs) {
      try {
        const parsedTabs = JSON.parse(savedTabs);
        setOpenTabs(parsedTabs);
        
        if (savedActiveTab) {
          const activeNote = parsedTabs.find((tab: Note) => tab.id === savedActiveTab);
          if (activeNote) {
            setSelectedNote(activeNote);
            setActiveTab(savedActiveTab);
          }
        }
      } catch (error) {
        console.error('Failed to parse saved tabs:', error);
      }
    }
  }, []);

  // Save tabs to localStorage when they change
  useEffect(() => {
    localStorage.setItem('openTabs', JSON.stringify(openTabs));
    localStorage.setItem('activeTab', activeTab || '');
  }, [openTabs, activeTab]);

  // Update notes in tabs when notes change
  useEffect(() => {
    if (notes.length > 0) {
      setOpenTabs(prevTabs => 
        prevTabs.map(tab => {
          const updatedNote = notes.find(note => note.id === tab.id);
          return updatedNote || tab;
        })
      );
    }
  }, [notes]);

  const fetchNotes = async () => {
    const res = await fetch('/api/notes');
    const data = await res.json();
    setNotes(data);
  };

  const createBlankNote = async () => {
    if (isCreatingNote) return;
    
    try {
      setIsCreatingNote(true);
      await fetchNotes();
      
      const untitledNotes = notes.filter(note => note.title.startsWith('Untitled_'));
      const numbers = untitledNotes.map(note => {
        const match = note.title.match(/Untitled_(\d+)/);
        return match ? parseInt(match[1]) : 0;
      });
      const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
      const newTitle = `Untitled_${nextNumber}`;

      // Get the lowest position
      const firstNote = notes[0];
      const newPosition = firstNote ? firstNote.position - 1 : 0;

      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: newTitle, 
          content: '',
          position: newPosition 
        }),
      });
      const newNote = await response.json();
      setNotes(prevNotes => [newNote, ...prevNotes]);
      setSelectedNote(newNote);
      
      // Add to open tabs
      setOpenTabs(prevTabs => [newNote, ...prevTabs]);
      setActiveTab(newNote.id);
    } finally {
      setIsCreatingNote(false);
    }
  };

  const handleNoteSelect = (note: Note | null) => {
    if (!note) return;
    setSelectedNote(note);
    // Add to open tabs if not already present
    if (!openTabs.find(tab => tab.id === note.id)) {
      setOpenTabs(prevTabs => [...prevTabs, note]);
    }
    setActiveTab(note.id);
  };

  const closeTab = (noteId: string) => {
    setOpenTabs(prev => prev.filter(note => note.id !== noteId));
    
    if (activeTab === noteId) {
      const remainingTabs = openTabs.filter(note => note.id !== noteId);
      if (remainingTabs.length > 0) {
        const lastTab = remainingTabs[remainingTabs.length - 1];
        setActiveTab(lastTab.id);
        setSelectedNote(lastTab);
      } else {
        setActiveTab(undefined);
        setSelectedNote(null);
      }
    }
  };

  const deleteNote = async (id: string) => {
    await fetch('/api/notes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setNotes(prevNotes => prevNotes.filter(note => note.id !== id));
    closeTab(id);
  };

  const handleDeleteNotes = async (noteIds: string[]) => {
    try {
      await Promise.all(noteIds.map(id => deleteNote(id)));
      toast({
        title: "Success",
        description: `Deleted ${noteIds.length} note${noteIds.length > 1 ? 's' : ''}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete notes",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Navbar
        notes={notes}
        openTabs={openTabs}
        setActiveTab={setActiveTab}
        setSelectedNote={setSelectedNote}
        setOpenTabs={setOpenTabs}
      />
      <div className="flex relative h-[calc(100vh-4rem)]">
        <Sidebar
          notes={notes}
          selectedNote={selectedNote}
          onNoteSelect={handleNoteSelect}
          onAddNote={createBlankNote}
          onExpand={setIsSidebarExpanded}
          onDeleteNotes={handleDeleteNotes}
        />
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {openTabs.length > 0 ? (
            <Tabs
              value={activeTab}
              onValueChange={(tabId) => {
                setActiveTab(tabId);
                const note = notes.find((n) => n.id === tabId);
                if (note) setSelectedNote(note);
              }}
              className="flex-1"
            >
              <div className="border-b">
                <TabsList className="w-auto justify-start h-10 rounded-none border-b bg-transparent p-0">
                  {openTabs.map((tab) => (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className="relative h-10 px-4 rounded-none border-r data-[state=active]:bg-gray-200 data-[state=active]:shadow-none"
                    >
                      {tab.title}
                      <div
                        className="ml-2 hover:bg-muted rounded-sm p-1 cursor-pointer inline-flex items-center justify-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          closeTab(tab.id);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </div>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              {openTabs.map((tab) => (
                <TabsContent key={tab.id} value={tab.id} className="flex-1 mt-[-0.4rem]">
                  <div className="p-4 h-full overflow-auto">
                    <NoteCard noteId={tab.id} initialTiles={tab.tiles || []} />
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Select a note or create a new one
            </div>
          )}
        </div>
      </div>
    </>
  );
} 