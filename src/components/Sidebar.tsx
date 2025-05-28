'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

interface Note {
  id: string;
  title: string;
  content: string | null;
  highlights: { word: string }[];
}

interface SidebarProps {
  notes: Note[];
  selectedNote: Note | null;
  onNoteSelect: (note: Note) => void;
  onAddNote: () => void;
}

export function Sidebar({ notes, selectedNote, onNoteSelect, onAddNote }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div 
      className={`absolute left-0 top-0 h-full transition-all duration-300 ease-in-out z-10 ${
        isExpanded ? 'w-80' : 'w-16'
      }`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full bg-background border shadow-sm"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>
      <div className="h-full border-r bg-background overflow-hidden flex flex-col">
        <div className="p-2 border-b">
          <Button 
            onClick={onAddNote}
            className={`w-full justify-start gap-2 ${!isExpanded && 'px-2'}`}
            variant="ghost"
          >
            <Plus className="h-4 w-4" />
            {isExpanded && "Add New Note"}
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-2 p-2">
            {notes.map((note) => (
              <Card 
                key={note.id} 
                className={`cursor-pointer transition-colors ${
                  selectedNote?.id === note.id ? 'bg-accent' : ''
                }`}
                onClick={() => onNoteSelect(note)}
              >
                <CardHeader className="p-3">
                  <CardTitle className={`text-lg truncate ${!isExpanded && 'text-center'}`}>
                    {isExpanded ? note.title : note.title.charAt(0)}
                  </CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
} 