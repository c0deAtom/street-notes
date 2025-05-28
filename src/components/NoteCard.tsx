'use client'

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EditNote } from '@/components/EditNote';
import { MoreVertical, Trash2, Edit2, Play, Pause, Rewind, FastForward, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { audioStorage } from '@/lib/audioStorage';
import crypto from 'crypto';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { createPortal } from 'react-dom';
import { cn } from "@/lib/utils";

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

interface QuizOption {
  word: string;
  isCorrect: boolean;
}

export function NoteCard({ note, onDelete, onUpdate, isEditing: initialIsEditing = false }: NoteCardProps) {
  const [isEditing, setIsEditing] = useState(initialIsEditing);
  const [highlightedWords, setHighlightedWords] = useState<Set<string>>(new Set());
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [highlightTimeout, setHighlightTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentContentHash, setCurrentContentHash] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isQuizMode, setIsQuizMode] = useState(false);
  const [quizOptions, setQuizOptions] = useState<QuizOption[]>([]);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [revealedWords, setRevealedWords] = useState<Set<string>>(new Set());
  const [wrongAnswers, setWrongAnswers] = useState<Set<string>>(new Set());
  const optionsRef = useRef<HTMLDivElement>(null);
  const [allWords] = useState<string[]>(() => {
    const words = new Set<string>();
    note.highlights.forEach(h => words.add(h.word));
    return Array.from(words);
  });

  // Check for existing audio in browser storage when note loads
  useEffect(() => {
    const checkExistingAudio = async () => {
      if (!note.content) return;
      
      const contentHash = crypto.createHash('md5').update(note.content).digest('hex');
      setCurrentContentHash(contentHash);
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
      
      // Delete old audio if it exists
      if (currentContentHash) {
        await audioStorage.deleteAudio(note.id);
      }

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
      setCurrentContentHash(contentHash);
      toast.success('Audio generated successfully');
    } catch (error) {
      console.error('Text-to-speech error:', error);
      toast.error('Failed to generate audio');
    } finally {
      setIsConverting(false);
    }
  };

  const handlePlayAudio = async () => {
    if (!audioUrl) {
      if (!note.content) return;
      try {
        await generateAudio(note.content);
        return;
      } catch (error) {
        toast.error('Failed to generate audio');
        return;
      }
    }

    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
    }

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (seconds: number) => {
    if (!audioRef.current) return;
    const newTime = audioRef.current.currentTime + seconds;
    audioRef.current.currentTime = Math.max(0, Math.min(newTime, audioRef.current.duration));
  };

  // Update audio event listeners when audioUrl changes
  useEffect(() => {
    if (!audioUrl) return;

    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
    }

    const audio = audioRef.current;

    const handleEnded = () => {
      setIsPlaying(false);
      audio.currentTime = 0;
    };

    const handleError = () => {
      toast.error('Failed to play audio');
      setIsPlaying(false);
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.pause();
      audio.currentTime = 0;
    };
  }, [audioUrl]);

  const handleDelete = async () => {
    try {
      // Delete audio from browser storage
      await audioStorage.deleteAudio(note.id);
      
      // Clean up the current audio URL
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      setCurrentContentHash(null);
      
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

  const generateQuizOptions = (correctWord: string) => {
    const otherWords = allWords.filter(word => word !== correctWord);
    const randomWords = otherWords
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    
    const options = [
      { word: correctWord, isCorrect: true },
      ...randomWords.map(word => ({ word, isCorrect: false }))
    ].sort(() => Math.random() - 0.5);

    setQuizOptions(options);
  };

  const handleWordClick = (word: string, element: HTMLSpanElement) => {
    if (!isQuizMode) return;
    const rect = element.getBoundingClientRect();
    setPopoverPosition({
      x: rect.left,
      y: rect.bottom + window.scrollY
    });
    setSelectedWord(word);
    generateQuizOptions(word);
  };

  const handleOptionSelect = (option: QuizOption) => {
    if (option.isCorrect) {
      toast.success('Correct!');
      setRevealedWords(prev => new Set([...prev, selectedWord!]));
      setSelectedWord(null);
      setPopoverPosition(null);
      setWrongAnswers(new Set());
    } else {
      toast.error('Incorrect!');
      setWrongAnswers(prev => new Set([...prev, option.word]));
    }
  };

  // Add click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverPosition && optionsRef.current && !optionsRef.current.contains(event.target as Node)) {
        setSelectedWord(null);
        setPopoverPosition(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [popoverPosition]);

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
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            <div className='flex justify-between items-center'>
              {note.title}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleSeek(-10)}
                    disabled={!audioUrl}
                  >
                    <Rewind className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handlePlayAudio}
                    disabled={!note.content}
                  >
                    {isPlaying ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleSeek(10)}
                    disabled={!audioUrl}
                  >
                    <FastForward className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={isQuizMode ? "default" : "outline"}
                    size="icon"
                    onClick={() => {
                      setIsQuizMode(!isQuizMode);
                      if (!isQuizMode) {
                        setRevealedWords(new Set());
                        setWrongAnswers(new Set());
                      }
                    }}
                  >
                    <BookOpen className="h-4 w-4" />
                  </Button>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setIsEditing(true)}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={handleDelete}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent onMouseLeave={handleMouseLeave}>
          <p>
            {note.content?.split(' ').map((word, index, array) => {
              const isHighlighted = note.highlights.some(h => h.word === word);
              const shouldHide = isQuizMode && isHighlighted && !revealedWords.has(word);
              const isLastWord = index === array.length - 1;
              
              return (
                <span
                  key={index}
                  onMouseDown={() => handleMouseDown(word, note.id)}
                  onMouseUp={handleMouseUp}
                  onClick={(e) => handleWordClick(word, e.currentTarget)}
                  style={{ 
                    cursor: isQuizMode && isHighlighted ? 'pointer' : 'default',
                    backgroundColor: isHighlighted ? 'yellow' : 'transparent',
                    opacity: highlightedWords.has(word) ? 0.7 : 1,
                    color: shouldHide ? 'transparent' : 'inherit',
                    textDecoration: shouldHide ? 'underline' : 'none',
                    userSelect: 'none',
                    padding: isHighlighted ? '0 2px' : '0',
                    margin: isHighlighted ? '0 1px' : '0',
                    borderRadius: isHighlighted ? '2px' : '0'
                  }}
                >
                  {word}{!isLastWord && ' '}
                </span>
              );
            })}
          </p>
          <p className="mt-2">
            <strong>Highlights:</strong> {note.highlights.map(h => h.word).join(', ')}
          </p>
        </CardContent>
      </Card>

      {popoverPosition && selectedWord && typeof window !== 'undefined' && createPortal(
        <div
          ref={optionsRef}
          style={{
            position: 'fixed',
            left: popoverPosition.x,
            top: popoverPosition.y,
            zIndex: 50
          }}
        >
          <div className="bg-white rounded-lg shadow-lg p-2 w-48">
            <div className="grid gap-1">
              {quizOptions.map((option, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className={cn(
                    "justify-start text-sm w-full",
                    wrongAnswers.has(option.word) && "bg-red-100 text-red-600 hover:bg-red-100 hover:text-red-600"
                  )}
                  onClick={() => handleOptionSelect(option)}
                  disabled={wrongAnswers.has(option.word)}
                >
                  {option.word}
                </Button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
} 