'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Loader2, X, Pencil, Check } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import type { Note, Tile } from '@/types';

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
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>("");
  const { toast } = useToast();

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

  const handleEditTitleSave = async (note: Note) => {
    try {
      const response = await fetch('/api/notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: note.id, title: editTitle })
      });
      if (!response.ok) throw new Error('Failed to update note title');
      toast({ title: 'Success', description: 'Note title updated' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update note title', variant: 'destructive' });
    }
  };

  return (
    <div 
      className={`h-full border-r bg-background transition-all duration-300 ease-in-out hidden md:block ${
        isExpanded ? 'w-64' : 'w-16'
      }`}
      onMouseEnter={() => handleExpand(true)}
      onMouseLeave={() => handleExpand(false)}
    >
      <div className="flex flex-col h-full">
        <div className="p-4 flex items-center justify-between">
          {isExpanded && <h2 className="text-lg font-semibold">Notes</h2>}
          <div className="sticky top-0 flex gap-2">
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
                        {editingNoteId === note.id ? (
                          <form
                            onSubmit={e => {
                              e.preventDefault();
                              handleEditTitleSave(note);
                            }}
                            className="flex items-center gap-1 w-full"
                          >
                            <input
                              className="text-sm font-medium truncate text-1xl border rounded px-1 py-0.5 w-24 bg-background"
                              value={editTitle}
                              autoFocus
                              onChange={e => setEditTitle(e.target.value)}
                              onBlur={() => setEditingNoteId(null)}
                            />
                            <Button type="submit" size="icon" variant="ghost" className="h-6 w-6 p-0">
                              <Check className="h-4 w-4" />
                            </Button>
                          </form>
                        ) : (
                          <>
                            <div className="text-sm font-medium gap-2 min-h-12">
                              <div className={isExpanded ? "text-sm font-medium text-1xl max-h-10 overflow-y-auto w-full" : "text-sm font-medium text-1xl max-h-10 overflow-y-auto w-5"}>
                                {note.title}
                              </div>
                              {selectedNote?.id === note.id && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 ml-auto"
                                  onClick={e => {
                                    e.stopPropagation();
                                    setEditingNoteId(note.id);
                                    setEditTitle(note.title);
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </>
                        )}
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