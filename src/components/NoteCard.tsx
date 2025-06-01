"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Tile } from "./Tile";

interface Tile {
  id: string;
  title: string;
  content: string | null;
  position: number;
  noteId: string;
  highlightedWords?: string[];
}

interface NoteCardProps {
  noteId: string;
  initialTiles?: Tile[];
}

// Placeholder function to update note highlights in the database
const updateNoteHighlightsInDatabase = (noteId: string, highlights: string[]) => {
  // Implement the actual database update logic here
  console.log(`Updating highlights for note ${noteId}:`, highlights);
};

export function NoteCard({ noteId, initialTiles = [] }: NoteCardProps) {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [focusedTileId, setFocusedTileId] = useState<string | null>(null);
  const [isAddingTile, setIsAddingTile] = useState(false);
  const [deletingTileId, setDeletingTileId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Only set tiles if initialTiles is not empty
    if (initialTiles.length > 0) {
      setTiles(initialTiles.filter(tile => tile.noteId === noteId));
    }
  }, [initialTiles, noteId]);

  const handleTileFocus = (tileId: string) => {
    setFocusedTileId(tileId);
  };

  const addTile = async () => {
    try {
      setIsAddingTile(true);
      // Use negative position that decrements for each new tile
      const newPosition = tiles.length > 0 ? tiles[0].position - 1 : 0;
      
      const response = await fetch("/api/tiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Untitled Tile",
          content: "",
          noteId,
          position: newPosition,
        }),
      });

      if (!response.ok) throw new Error("Failed to add tile");

      const newTile = await response.json();
      setTiles([newTile, ...tiles]);
      setFocusedTileId(newTile.id);
      toast({
        title: "Success",
        description: "Tile added successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add tile",
        variant: "destructive",
      });
    } finally {
      setIsAddingTile(false);
    }
  };

  const updateNoteHighlights = () => {
    const allHighlightedWords = tiles.flatMap(tile => tile.highlightedWords || []);
    const uniqueWords = Array.from(new Set(allHighlightedWords));
    // Assuming there's a function to update the note's highlights
    updateNoteHighlightsInDatabase(noteId, uniqueWords);
  };

  useEffect(() => {
    updateNoteHighlights();
  }, [tiles]);

  const updateTile = async (tileId: string, title: string, content: string) => {
    try {
      const response = await fetch('/api/tiles', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: tileId, title, content }),
      });

      if (!response.ok) throw new Error('Failed to update tile');

      setTiles(tiles.map((tile) => 
        tile.id === tileId ? { ...tile, title, content } : tile
      ));
      updateNoteHighlights();
      toast({
        title: 'Success',
        description: 'Tile updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update tile',
        variant: 'destructive',
      });
    }
  };

  const deleteTile = async (tileId: string) => {
    try {
      setDeletingTileId(tileId);
      const response = await fetch('/api/tiles', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: tileId }),
      });

      if (!response.ok) throw new Error('Failed to delete tile');

      setTiles(tiles.filter((tile) => tile.id !== tileId));
      if (focusedTileId === tileId) {
        setFocusedTileId(null);
      }
      toast({
        title: 'Success',
        description: 'Tile deleted successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete tile',
        variant: 'destructive',
      });
    } finally {
      setDeletingTileId(null);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-8rem)]">
      <div className="absolute top-0 right-0 z-10">
        <Button 
          size="icon" 
          className="rounded-full h-12 w-12 shadow-lg"
          onClick={addTile}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      <div className="grid gap-4 pt-16 max-h-[calc(100vh-8rem)] overflow-y-auto pr-4 px-3">
        {tiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[calc(100vh-16rem)] text-muted-foreground">
            <p className="text-lg mb-4">No tiles yet</p>
            <p className="text-sm">Click the + button to add your first tile</p>
          </div>
        ) : (
          tiles.map((tile) => (
            <div
              key={tile.id}
              onClick={() => handleTileFocus(tile.id)}
              className={`transition-all duration-200 ${
                focusedTileId === tile.id
                  ? 'opacity-100 scale-100'
                  : 'opacity-85 scale-98 hover:opacity-95 hover:scale-99'
              }`}
            >
              <Tile
                id={tile.id}
                title={tile.title}
                content={tile.content}
                position={tile.position}
                onUpdate={updateTile}
                onDelete={deleteTile}
                isFocused={focusedTileId === tile.id}
                isDeleting={deletingTileId === tile.id}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
} 