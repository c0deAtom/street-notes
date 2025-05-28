'use client'

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EditNote } from '@/components/EditNote';
import { Volume2 } from 'lucide-react';
import { toast } from 'sonner';

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

  // Check for existing audio file when note loads
  useEffect(() => {
    const checkExistingAudio = async () => {
      if (!note.content) return;
      
      try {
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            text: note.content,
            noteId: note.id
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setAudioUrl(data.audioPath);
        }
      } catch (error) {
        console.error('Error checking audio file:', error);
      }
    };

    checkExistingAudio();
  }, [note.id]);

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

      const data = await response.json();
      setAudioUrl(data.audioPath);
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
    
    // Generate audio only after content is edited and saved
    if (content) {
      await generateAudio(content);
    }
  };

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
              <Button variant="destructive" onClick={() => onDelete(note.id)}>
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