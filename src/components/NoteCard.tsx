'use client'

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EditNote } from '@/components/EditNote';
import { Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { audioStorage } from '@/lib/audioStorage';
import crypto from 'crypto';

interface Highlight {
  word: string;
}

interface Note {
  id: string;
  title: string;
  content: string | null;
  highlights: Highlight[];
}

interface NoteCardProps {
  note: Note;
  onDelete: (id: string) => void;
  onUpdate: (id: string, content: string, highlights: Highlight[], title: string) => void;
  isEditing?: boolean;
}

export function NoteCard({ note, onDelete, onUpdate, isEditing: initialIsEditing = false }: NoteCardProps) {
  const [isEditing, setIsEditing] = useState(initialIsEditing);
  const [highlightedWords, setHighlightedWords] = useState<Set<string>>(new Set());
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [highlightTimeout, setHighlightTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Check for existing audio in browser storage when note loads
  useEffect(() => {
    const checkExistingAudio = async () => {
      if (!note.content) return;
      
      const contentHash = crypto.createHash('md5').update(note.content).digest('hex');
      const audioBlob = await audioStorage.getAudio(note.id, contentHash);
      
      if (audioBlob) {
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
      }
    };

    checkExistingAudio();
  }, [note.id, note.content]);

  const generateAudio = async (content: string) => {
    try {
      setIsConverting(true);
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: content,
          noteId: note.id
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to convert text to speech');
      }

      const contentHash = response.headers.get('X-Content-Hash');
      if (!contentHash) {
        throw new Error('Content hash not found in response');
      }

      const audioBlob = await response.blob();
      
      // Save to browser storage
      await audioStorage.saveAudio(note.id, contentHash, audioBlob);
      
      // Create URL for playback
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      toast.success('Audio generated successfully');
    } catch (error) {
      console.error('Text-to-speech error:', error);
      toast.error('Failed to generate audio');
    } finally {
      setIsConverting(false);
    }
  };

  const handlePlayAudio = () => {
    if (!audioUrl) return;

    const audio = new Audio(audioUrl);
    setIsPlaying(true);
    
    audio.onended = () => {
      setIsPlaying(false);
    };

    audio.onerror = () => {
      toast.error('Failed to play audio');
      setIsPlaying(false);
    };

    audio.play();
  };

  const handleDelete = async () => {
    try {
      // Delete audio from browser storage
      await audioStorage.deleteAudio(note.id);
      
      // Then delete the note
      onDelete(note.id);
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Failed to delete note');
    }
  };

  // Update isEditing state when prop changes
  useEffect(() => {
    setIsEditing(initialIsEditing);
  }, [initialIsEditing]);

  const handleMouseDown = (word: string, noteId: string) => {
    // Clear any existing timeout
    if (highlightTimeout) {
      clearTimeout(highlightTimeout);
    }
    
    // Set new timeout for 200ms
    const timeout = setTimeout(() => {
      setHighlightedWords(prev => new Set([...prev, word]));
      setSelectedNoteId(noteId);
    }, 200);
    
    setHighlightTimeout(timeout);
  };

  const handleMouseUp = async () => {
    // Clear the timeout if mouse is released before 200ms
    if (highlightTimeout) {
      clearTimeout(highlightTimeout);
      setHighlightTimeout(null);
    }

    if (highlightedWords.size > 0 && selectedNoteId) {
      const currentHighlights = new Set(note.highlights.map(h => h.word));
      const newHighlights = new Set<Highlight>();

      // Process each highlighted word
      highlightedWords.forEach(word => {
        if (currentHighlights.has(word)) {
          // Remove highlight if word is already highlighted
          currentHighlights.delete(word);
        } else {
          // Add highlight if word is not highlighted
          newHighlights.add({ word });
        }
      });

      // Combine remaining current highlights with new highlights
      const updatedHighlights = [
        ...Array.from(currentHighlights).map(word => ({ word })),
        ...Array.from(newHighlights)
      ];

      onUpdate(selectedNoteId, note.content || '', updatedHighlights, note.title);
      setHighlightedWords(new Set());
      setSelectedNoteId(null);
    }
  };

  const handleMouseLeave = () => {
    // Clear the timeout if mouse leaves before 200ms
    if (highlightTimeout) {
      clearTimeout(highlightTimeout);
      setHighlightTimeout(null);
    }
    setHighlightedWords(new Set());
    setSelectedNoteId(null);
  };

  const handleSave = async (id: string, title: string, content: string) => {
    const updatedHighlights = note.highlights.filter(highlight => 
      content.includes(highlight.word)
    );
    onUpdate(id, content, updatedHighlights, title);
    setIsEditing(false);
    
    // Generate new audio after content is edited
    if (content) {
      await generateAudio(content);
    }
  };

  // Clean up object URLs when component unmounts
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  if (isEditing) {
    return (
      <EditNote
        note={note}
        onSave={handleSave}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <div className='flex justify-between items-center'>
            {note.title}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePlayAudio}
                disabled={!audioUrl || isPlaying}
              >
                <Volume2 className={`h-4 w-4 ${isPlaying ? 'animate-pulse' : ''}`} />
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
              <Button onClick={() => setIsEditing(true)}>Edit</Button>
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent onMouseLeave={handleMouseLeave}>
        <p>
          {note.content?.split(' ').map((word, index) => (
            <span
              key={index}
              onMouseDown={() => handleMouseDown(word, note.id)}
              onMouseUp={handleMouseUp}
              style={{ 
                cursor: 'pointer', 
                backgroundColor: note.highlights.some(h => h.word === word) ? 'yellow' : 'transparent',
                opacity: highlightedWords.has(word) ? 0.7 : 1
              }}
            >
              {word}{' '}
            </span>
          ))}
        </p>
        <p className="mt-2">
          <strong>Highlights:</strong> {note.highlights.map(h => h.word).join(', ')}
        </p>
      </CardContent>
    </Card>
  );
} 