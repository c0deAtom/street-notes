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
}

interface NoteCardProps {
  noteId: string;
  initialTiles?: Tile[];
}

export function NoteCard({ noteId, initialTiles = [] }: NoteCardProps) {
  const [tiles, setTiles] = useState<Tile[]>(initialTiles.filter(tile => tile.noteId === noteId));
  const { toast } = useToast();

  useEffect(() => {
    setTiles(initialTiles.filter(tile => tile.noteId === noteId));
  }, [initialTiles, noteId]);

  const addTile = async () => {
    try {
      const response = await fetch("/api/tiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Untitled Tile",
          content: "",
          noteId,
          position: tiles.length,
        }),
      });

      if (!response.ok) throw new Error("Failed to add tile");

      const newTile = await response.json();
      setTiles([...tiles, newTile]);
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
    }
  };

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
      const response = await fetch('/api/tiles', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: tileId }),
      });

      if (!response.ok) throw new Error('Failed to delete tile');

      setTiles(tiles.filter((tile) => tile.id !== tileId));
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
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-8rem)] ">
      <div className="absolute top-0 right-0 z-10">
        <Button 
          size="icon" 
          className="rounded-full h-12 w-12 shadow-lg"
          onClick={addTile}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      <div className="grid gap-4 pt-16">
        {tiles.map((tile) => (
          <Tile
            key={tile.id}
            id={tile.id}
            title={tile.title}
            content={tile.content}
            position={tile.position}
            onUpdate={updateTile}
            onDelete={deleteTile}
          />
        ))}
      </div>
    </div>
  );
} 