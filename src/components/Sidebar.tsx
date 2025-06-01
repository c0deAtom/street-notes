'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Loader2, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

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
  highlights: { word: string }[];
  tiles: Tile[];
  createdAt: Date;
  position: number;
  
}

interface SidebarProps {
  notes: Note[];
  selectedNote: Note | null;
  onNoteSelect: (note: Note | null) => void;
  onAddNote: () => Promise<void>;
  onExpand: (expanded: boolean) => void;
  onDeleteNotes: (noteIds: string[]) => void;
}

export function Sidebar({ notes, selectedNote, onNoteSelect, onAddNote, onExpand, onDeleteNotes }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isDeletingNotes, setIsDeletingNotes] = useState(false);
  const [isBigView, setIsBigView] = useState(false);

  const handleExpand = (expanded: boolean) => {
    setIsExpanded(expanded);
    onExpand(expanded);
  };

  const toggleDeleteMode = () => {
    setIsDeleteMode(!isDeleteMode);
    setSelectedNotes([]);
  };

  const handleNoteSelect = (note: Note) => {
    if (isDeleteMode) {
      setSelectedNotes(prev => 
        prev.includes(note.id) 
          ? prev.filter(id => id !== note.id)
          : [...prev, note.id]
      );
    } else {
      onNoteSelect(note);
    }
  };

  const handleDeleteSelected = async () => {
    try {
      setIsDeletingNotes(true);
      await onDeleteNotes(selectedNotes);
      setSelectedNotes([]);
      setIsDeleteMode(false);
    } finally {
      setIsDeletingNotes(false);
    }
  };

  const handleAddNote = async () => {
    try {
      setIsAddingNote(true);
      await onAddNote();
    } finally {
      setIsAddingNote(false);
    }
  };

  const toggleViewMode = () => {
    setIsBigView(!isBigView);
  };

  return (
    <div 
      className={`h-full border-r bg-background transition-all duration-300 ease-in-out ${
        isExpanded ? 'w-64' : 'w-16'
      }`}
      onMouseEnter={() => handleExpand(true)}
      onMouseLeave={() => handleExpand(false)}
    >
      <div className="flex flex-col h-full">
        <div className="p-4 flex items-center justify-between">
          {isExpanded && <h2 className="text-lg font-semibold">Notes</h2>}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleAddNote}
              className="h-8 w-8"
              disabled={isAddingNote}
            >
              {isAddingNote ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
            {isExpanded && (
            <Button
              variant="outline"
              size="icon"
              onClick={toggleViewMode}
              className="h-8 w-8"
            >
              {isBigView ? 'L' : 'V'}
                </Button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-2 space-y-2">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className={`transition-all duration-200 ${
                    selectedNote?.id === note.id && !isDeleteMode
                      ? 'opacity-100 scale-100'
                      : 'opacity-85 scale-98 hover:opacity-95 hover:scale-99'
                  }`}
                >
                  <div
                    className={`cursor-pointer transition-colors  flex items-left justify-left rounded-md border-2 ${
                      selectedNote?.id === note.id && !isDeleteMode
                        ? 'bg-gray-200'
                        : 'hover:bg-gray-200'
                    } ${isDeleteMode && selectedNotes.includes(note.id) ? 'border-primary' : ''}`}
                    onClick={() => handleNoteSelect(note)}
                  >
                    <div className="p-3">
                      <div className="flex items-center gap-2">
                        {isDeleteMode && (
                          <Checkbox
                            checked={selectedNotes.includes(note.id)}
                            onCheckedChange={() => handleNoteSelect(note)}
                            className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                          />
                        )}
                        <div className="text-sm font-medium truncate text-1xl">
                          {isExpanded ? note.title : note.title.charAt(0)}
                        </div>
                      </div>
                      {isExpanded && isBigView && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          {note.tiles.map(tile => (
                            <div key={tile.id} className="truncate">
                              {tile.title}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
        {isDeleteMode && selectedNotes.length > 0 && (
          <div className="p-4 border-t">
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={handleDeleteSelected}
              disabled={isDeletingNotes}
            >
              {isDeletingNotes ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected ({selectedNotes.length})
                </>
              )}
            </Button>
          </div>
        )}
        {isExpanded && (
          <div className="flex justify-between items-center mb-2 px-2">
            <Button
              variant={isDeleteMode ? "destructive" : "outline"}
              size="sm"
              onClick={toggleDeleteMode}
              className="w-full"
              disabled={isDeletingNotes}
            >
              {isDeleteMode ? (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Notes
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
} 