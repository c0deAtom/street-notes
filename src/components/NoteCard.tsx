'use client'

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { EditNote } from '@/components/EditNote';
import { MoreVertical, Trash2, Edit2, Play, Pause, Rewind, FastForward, BookOpen, Loader2 } from 'lucide-react';
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
import { AIChatInput } from '@/components/AIChatInput';
import ReactMarkdown from 'react-markdown';

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

interface AudioMetadata {
  noteId: string;
  contentHash: string;
  timestamp: number;
  title: string;
}

interface RevealedWord {
  word: string;
  index: number;
}

interface QuizStats {
  correct: number;
  wrong: number;
  total: number;
}

// Add new interface for persisted quiz state
interface PersistedQuizState {
  revealedWords: RevealedWord[];
  quizStats: QuizStats;
  showResults: boolean;
  isQuizMode: boolean;
}

// Add interface for persisted tabs state
interface PersistedTabsState {
  openTabs: {
    id: string;
    title: string;
    lastOpened: number;
  }[];
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
  const [isQuizMode, setIsQuizMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const persistedState = localStorage.getItem(`quiz-state-${note.id}`);
      if (persistedState) {
        try {
          const parsedState = JSON.parse(persistedState) as PersistedQuizState;
          return parsedState.isQuizMode;
        } catch (error) {
          console.error('Error loading quiz mode state:', error);
        }
      }
    }
    return false;
  });
  const [quizOptions, setQuizOptions] = useState<QuizOption[]>([]);
  const [selectedWord, setSelectedWord] = useState<RevealedWord | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [revealedWords, setRevealedWords] = useState<Set<RevealedWord>>(() => {
    if (typeof window !== 'undefined') {
      const persistedState = localStorage.getItem(`quiz-state-${note.id}`);
      if (persistedState) {
        try {
          const parsedState = JSON.parse(persistedState) as PersistedQuizState;
          if (parsedState.revealedWords && Array.isArray(parsedState.revealedWords)) {
            const restoredRevealedWords = new Set<RevealedWord>();
            parsedState.revealedWords.forEach(word => {
              if (word && typeof word.word === 'string' && typeof word.index === 'number') {
                restoredRevealedWords.add({ word: word.word, index: word.index });
              }
            });
            return restoredRevealedWords;
          }
        } catch (error) {
          console.error('Error loading revealed words state:', error);
        }
      }
    }
    return new Set();
  });
  const [wrongAnswers, setWrongAnswers] = useState<Set<string>>(new Set());
  const optionsRef = useRef<HTMLDivElement>(null);
  const [allWords] = useState<string[]>(() => {
    const words = new Set<string>();
    note.highlights.forEach(h => words.add(h.word));
    return Array.from(words);
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [audioMetadata, setAudioMetadata] = useState<AudioMetadata | null>(null);
  const [quizStats, setQuizStats] = useState<QuizStats>(() => {
    if (typeof window !== 'undefined') {
      const persistedState = localStorage.getItem(`quiz-state-${note.id}`);
      if (persistedState) {
        try {
          const parsedState = JSON.parse(persistedState) as PersistedQuizState;
          return parsedState.quizStats || { correct: 0, wrong: 0, total: 0 };
        } catch (error) {
          console.error('Error loading quiz stats:', error);
        }
      }
    }
    return { correct: 0, wrong: 0, total: 0 };
  });
  const [showResults, setShowResults] = useState(() => {
    if (typeof window !== 'undefined') {
      const persistedState = localStorage.getItem(`quiz-state-${note.id}`);
      if (persistedState) {
        try {
          const parsedState = JSON.parse(persistedState) as PersistedQuizState;
          return parsedState.showResults || false;
        } catch (error) {
          console.error('Error loading show results state:', error);
        }
      }
    }
    return false;
  });

  // Clean up quiz data only when quiz is finished or turned off
  useEffect(() => {
    const cleanupQuizData = () => {
      // Only clean up if quiz is not active
      if (!isQuizMode || showResults) {
        localStorage.removeItem(`quiz-state-${note.id}`);
      }
    };

    // Clean up when quiz mode is turned off or quiz is finished
    if (!isQuizMode || showResults) {
      cleanupQuizData();
    }

    // Clean up when tab is closed, but only if quiz is finished
    const handleBeforeUnload = () => {
      if (showResults) {
        cleanupQuizData();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Only clean up on unmount if quiz is finished
      if (showResults) {
        cleanupQuizData();
      }
    };
  }, [isQuizMode, showResults, note.id]);

  // Reset quiz state when quiz mode is toggled off
  useEffect(() => {
    if (!isQuizMode) {
      setQuizStats({ correct: 0, wrong: 0, total: 0 });
      setShowResults(false);
      setRevealedWords(new Set());
      setWrongAnswers(new Set());
      localStorage.removeItem(`quiz-state-${note.id}`);
    }
  }, [isQuizMode, note.id]);

  // Save quiz state whenever it changes
  useEffect(() => {
    if (isQuizMode && !showResults) {  // Only save if quiz is active and not finished
      try {
        const stateToPersist: PersistedQuizState = {
          revealedWords: Array.from(revealedWords).map(word => ({
            word: word.word,
            index: word.index
          })),
          quizStats,
          showResults,
          isQuizMode
        };
        localStorage.setItem(`quiz-state-${note.id}`, JSON.stringify(stateToPersist));
      } catch (error) {
        console.error('Error saving quiz state:', error);
      }
    }
  }, [revealedWords, quizStats, showResults, isQuizMode, note.id]);

  // Show results when all words are revealed
  useEffect(() => {
    if (isQuizMode && note.highlights.length > 0) {
      const allWordsRevealed = note.highlights.every(highlight => 
        Array.from(revealedWords).some(r => r.word === highlight.word)
      );
      if (allWordsRevealed) {
        setShowResults(true);
      }
    }
  }, [revealedWords, isQuizMode, note.highlights]);

  const generateContentHash = (content: string) => {
    return crypto.createHash('sha256')
      .update(content.trim().toLowerCase())
      .digest('hex');
  };

  // Check for existing audio in browser storage when note loads
  useEffect(() => {
    const checkExistingAudio = async () => {
      if (!note.content) return;
      
      const contentHash = generateContentHash(note.content);
      const metadata: AudioMetadata = {
        noteId: note.id,
        contentHash,
        timestamp: Date.now(),
        title: note.title
      };

      const audioBlob = await audioStorage.getAudio(metadata);
      
      if (audioBlob) {
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        setCurrentContentHash(contentHash);
        setAudioMetadata(metadata);
        setIsAudioReady(true);
      }
    };

    checkExistingAudio();
  }, [note.id, note.content, note.title]);

  const generateAudio = async (content: string) => {
    try {
      setIsProcessing(true);
      setIsAudioReady(false);
      
      // Delete old audio if it exists
      if (currentContentHash) {
        await audioStorage.deleteAudio(note.id);
      }

      const contentHash = generateContentHash(content);
      const metadata: AudioMetadata = {
        noteId: note.id,
        contentHash,
        timestamp: Date.now(),
        title: note.title
      };

      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: content,
          metadata
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to convert text to speech');
      }

      const audioBlob = await response.blob();
      
      // Save to browser storage with metadata
      await audioStorage.saveAudio(metadata, audioBlob);
      
      // Create URL for playback
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      setCurrentContentHash(contentHash);
      setAudioMetadata(metadata);
      setIsAudioReady(true);
      toast.success('Audio generated successfully');
    } catch (error) {
      console.error('Text-to-speech error:', error);
      toast.error('Failed to generate audio');
    } finally {
      setIsProcessing(false);
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

  // Save tab state when note is opened
  useEffect(() => {
    try {
      const existingTabs = localStorage.getItem('open-tabs');
      const tabsState: PersistedTabsState = existingTabs ? JSON.parse(existingTabs) : { openTabs: [] };
      
      // Remove this note if it exists
      tabsState.openTabs = tabsState.openTabs.filter(tab => tab.id !== note.id);
      
      // Add this note to the beginning
      tabsState.openTabs.unshift({
        id: note.id,
        title: note.title,
        lastOpened: Date.now()
      });
      
      // Keep only the last 5 tabs
      tabsState.openTabs = tabsState.openTabs.slice(0, 5);
      
      localStorage.setItem('open-tabs', JSON.stringify(tabsState));
    } catch (error) {
      console.error('Error saving tab state:', error);
    }
  }, [note.id, note.title]);

  // Clean up tab state when note is deleted
  const handleDelete = async () => {
    try {
      // Delete audio from browser storage
      if (audioMetadata) {
        await audioStorage.deleteAudio(audioMetadata.noteId);
      }
      
      // Clean up the current audio URL
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      setCurrentContentHash(null);
      setAudioMetadata(null);
      
      // Remove from open tabs
      const existingTabs = localStorage.getItem('open-tabs');
      if (existingTabs) {
        const tabsState: PersistedTabsState = JSON.parse(existingTabs);
        tabsState.openTabs = tabsState.openTabs.filter(tab => tab.id !== note.id);
        localStorage.setItem('open-tabs', JSON.stringify(tabsState));
      }
      
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

  // Clean up tab state when component unmounts
  useEffect(() => {
    return () => {
      try {
        const existingTabs = localStorage.getItem('open-tabs');
        if (existingTabs) {
          const tabsState: PersistedTabsState = JSON.parse(existingTabs);
          // Remove this note from open tabs
          tabsState.openTabs = tabsState.openTabs.filter(tab => tab.id !== note.id);
          localStorage.setItem('open-tabs', JSON.stringify(tabsState));
        }
      } catch (error) {
        console.error('Error cleaning up tab state:', error);
      }
    };
  }, [note.id]);

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

  const handleWordClick = (word: string, element: HTMLSpanElement, index: number) => {
    if (!isQuizMode) return;
    
    // Only show popover for highlighted words
    const isHighlighted = note.highlights.some(h => h.word === word);
    if (!isHighlighted) return;
    
    // Reset states before opening new popover
    setWrongAnswers(new Set());
    setQuizOptions([]);
    
    const rect = element.getBoundingClientRect();
    setPopoverPosition({
      x: rect.left,
      y: rect.bottom + window.scrollY
    });
    setSelectedWord({ word, index });
    generateQuizOptions(word);
  };

  const handleOptionSelect = (option: QuizOption) => {
    if (option.isCorrect && selectedWord) {
      toast.success('Correct!');
      setRevealedWords(prev => new Set([...prev, selectedWord]));
      setQuizStats(prev => ({
        ...prev,
        correct: prev.correct + 1,
        total: prev.total + 1
      }));
      setSelectedWord(null);
      setPopoverPosition(null);
      setWrongAnswers(new Set());
    } else {
      toast.error('Incorrect!');
      setWrongAnswers(prev => new Set([...prev, option.word]));
      setQuizStats(prev => ({
        ...prev,
        wrong: prev.wrong + 1,
        total: prev.total + 1
      }));
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

  const handleAIResponse = async (response: string) => {
    try {
      // Get key terms from AI
      const keyTermsResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: response,
          extractKeyTerms: true
        }),
      });

      if (!keyTermsResponse.ok) {
        throw new Error('Failed to extract key terms');
      }

      const { keyTerms } = await keyTermsResponse.json();
      
      // Create highlights from key terms
      const newHighlights = keyTerms.map((term: string) => ({ word: term.toLowerCase() }));

      // Combine existing highlights with new ones
      const updatedHighlights = [
        ...note.highlights,
        ...newHighlights
      ];

      // Format the response with proper spacing
      const formattedResponse = `\n\n---\n\n${response}`;

      // Update note with new content and highlights
      if (note.content) {
        onUpdate(note.id, note.content + formattedResponse, updatedHighlights, note.title);
      } else {
        onUpdate(note.id, response, updatedHighlights, note.title);
      }
    } catch (error) {
      console.error('Error extracting key terms:', error);
      toast.error('Failed to extract key terms');
      
      // Fallback to updating just the content without new highlights
      if (note.content) {
        onUpdate(note.id, note.content + '\n\n' + response, note.highlights, note.title);
      } else {
        onUpdate(note.id, response, note.highlights, note.title);
      }
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
    <>
      <Card className="flex flex-col h-[calc(88vh-2rem)]">
        <CardHeader className="flex-shrink-0">
          <CardTitle>
            <div className='flex justify-between items-center'>
              {note.title}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleSeek(-10)}
                    disabled={!audioUrl || isProcessing}
                  >
                    <Rewind className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handlePlayAudio}
                    disabled={!note.content || isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isPlaying ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleSeek(10)}
                    disabled={!audioUrl || isProcessing}
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
        <CardContent onMouseLeave={handleMouseLeave} className="flex-1 overflow-hidden">
          <div className="flex gap-4 h-full">
            <div className="flex-1 overflow-y-auto">
              <div className="prose prose-sm max-w-none dark:prose-invert pb-4">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => {
                      if (typeof children !== 'string') {
                        return <div>{children}</div>;
                      }
                      return (
                        <div>
                          {children.split(' ').map((word, index, array) => {
                            const isHighlighted = note.highlights.some(h => h.word === word.toLowerCase());
                            const shouldHide = isQuizMode && isHighlighted && !Array.from(revealedWords).some(r => r.word === word.toLowerCase() && r.index === index);
                            const isLastWord = index === array.length - 1;
                            
                            return (
                              <span
                                key={index}
                                onMouseDown={() => handleMouseDown(word.toLowerCase(), note.id)}
                                onMouseUp={handleMouseUp}
                                onClick={(e) => handleWordClick(word.toLowerCase(), e.currentTarget, index)}
                                style={{ 
                                  cursor: isQuizMode && isHighlighted ? 'pointer' : 'default',
                                  backgroundColor: isHighlighted ? 'yellow' : 'transparent',
                                  opacity: highlightedWords.has(word.toLowerCase()) ? 0.7 : 1,
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
                        </div>
                      );
                    },
                    ul: ({ children }) => <ul className="list-disc pl-6 my-2">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-6 my-2">{children}</ol>,
                    li: ({ children }) => {
                      // Handle both string and array of children
                      const processContent = (content: any): React.ReactNode => {
                        if (typeof content === 'string') {
                          return content.split(' ').map((word, index, array) => {
                            const isHighlighted = note.highlights.some(h => h.word === word.toLowerCase());
                            const shouldHide = isQuizMode && isHighlighted && !Array.from(revealedWords).some(r => r.word === word.toLowerCase() && r.index === index);
                            const isLastWord = index === array.length - 1;
                            
                            return (
                              <span
                                key={index}
                                onMouseDown={() => handleMouseDown(word.toLowerCase(), note.id)}
                                onMouseUp={handleMouseUp}
                                onClick={(e) => handleWordClick(word.toLowerCase(), e.currentTarget, index)}
                                style={{ 
                                  cursor: isQuizMode && isHighlighted ? 'pointer' : 'default',
                                  backgroundColor: isHighlighted ? 'yellow' : 'transparent',
                                  opacity: highlightedWords.has(word.toLowerCase()) ? 0.7 : 1,
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
                          });
                        }
                        
                        if (Array.isArray(content)) {
                          return content.map((item, index) => (
                            <span key={index}>
                              {processContent(item)}
                              {index < content.length - 1 && ' '}
                            </span>
                          ));
                        }
                        
                        return content;
                      };

                      return (
                        <li className="my-1">
                          {processContent(children)}
                        </li>
                      );
                    },
                    h1: ({ children }) => {
                      if (typeof children !== 'string') {
                        return <h1 className="text-2xl font-bold mt-4 mb-2">{children}</h1>;
                      }
                      return (
                        <h1 className="text-2xl font-bold mt-4 mb-2">
                          {children.split(' ').map((word, index, array) => {
                            const isHighlighted = note.highlights.some(h => h.word === word.toLowerCase());
                            const shouldHide = isQuizMode && isHighlighted && !Array.from(revealedWords).some(r => r.word === word.toLowerCase() && r.index === index);
                            const isLastWord = index === array.length - 1;
                            
                            return (
                              <span
                                key={index}
                                onMouseDown={() => handleMouseDown(word.toLowerCase(), note.id)}
                                onMouseUp={handleMouseUp}
                                onClick={(e) => handleWordClick(word.toLowerCase(), e.currentTarget, index)}
                                style={{ 
                                  cursor: isQuizMode && isHighlighted ? 'pointer' : 'default',
                                  backgroundColor: isHighlighted ? 'yellow' : 'transparent',
                                  opacity: highlightedWords.has(word.toLowerCase()) ? 0.7 : 1,
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
                        </h1>
                      );
                    },
                    h2: ({ children }) => {
                      if (typeof children !== 'string') {
                        return <h2 className="text-xl font-bold mt-4 mb-2">{children}</h2>;
                      }
                      return (
                        <h2 className="text-xl font-bold mt-4 mb-2">
                          {children.split(' ').map((word, index, array) => {
                            const isHighlighted = note.highlights.some(h => h.word === word.toLowerCase());
                            const shouldHide = isQuizMode && isHighlighted && !Array.from(revealedWords).some(r => r.word === word.toLowerCase() && r.index === index);
                            const isLastWord = index === array.length - 1;
                            
                            return (
                              <span
                                key={index}
                                onMouseDown={() => handleMouseDown(word.toLowerCase(), note.id)}
                                onMouseUp={handleMouseUp}
                                onClick={(e) => handleWordClick(word.toLowerCase(), e.currentTarget, index)}
                                style={{ 
                                  cursor: isQuizMode && isHighlighted ? 'pointer' : 'default',
                                  backgroundColor: isHighlighted ? 'yellow' : 'transparent',
                                  opacity: highlightedWords.has(word.toLowerCase()) ? 0.7 : 1,
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
                        </h2>
                      );
                    },
                    h3: ({ children }) => {
                      if (typeof children !== 'string') {
                        return <h3 className="text-lg font-bold mt-3 mb-2">{children}</h3>;
                      }
                      return (
                        <h3 className="text-lg font-bold mt-3 mb-2">
                          {children.split(' ').map((word, index, array) => {
                            const isHighlighted = note.highlights.some(h => h.word === word.toLowerCase());
                            const shouldHide = isQuizMode && isHighlighted && !Array.from(revealedWords).some(r => r.word === word.toLowerCase() && r.index === index);
                            const isLastWord = index === array.length - 1;
                            
                            return (
                              <span
                                key={index}
                                onMouseDown={() => handleMouseDown(word.toLowerCase(), note.id)}
                                onMouseUp={handleMouseUp}
                                onClick={(e) => handleWordClick(word.toLowerCase(), e.currentTarget, index)}
                                style={{ 
                                  cursor: isQuizMode && isHighlighted ? 'pointer' : 'default',
                                  backgroundColor: isHighlighted ? 'yellow' : 'transparent',
                                  opacity: highlightedWords.has(word.toLowerCase()) ? 0.7 : 1,
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
                        </h3>
                      );
                    },
                    strong: ({ children }) => {
                      if (typeof children !== 'string') {
                        return <strong className="font-bold">{children}</strong>;
                      }
                      return (
                        <strong className="font-bold">
                          {children.split(' ').map((word, index, array) => {
                            const isHighlighted = note.highlights.some(h => h.word === word.toLowerCase());
                            const shouldHide = isQuizMode && isHighlighted && !Array.from(revealedWords).some(r => r.word === word.toLowerCase() && r.index === index);
                            const isLastWord = index === array.length - 1;
                            
                            return (
                              <span
                                key={index}
                                onMouseDown={() => handleMouseDown(word.toLowerCase(), note.id)}
                                onMouseUp={handleMouseUp}
                                onClick={(e) => handleWordClick(word.toLowerCase(), e.currentTarget, index)}
                                style={{ 
                                  cursor: isQuizMode && isHighlighted ? 'pointer' : 'default',
                                  backgroundColor: isHighlighted ? 'yellow' : 'transparent',
                                  opacity: highlightedWords.has(word.toLowerCase()) ? 0.7 : 1,
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
                        </strong>
                      );
                    },
                    em: ({ children }) => {
                      if (typeof children !== 'string') {
                        return <em className="italic">{children}</em>;
                      }
                      return (
                        <em className="italic">
                          {children.split(' ').map((word, index, array) => {
                            const isHighlighted = note.highlights.some(h => h.word === word.toLowerCase());
                            const shouldHide = isQuizMode && isHighlighted && !Array.from(revealedWords).some(r => r.word === word.toLowerCase() && r.index === index);
                            const isLastWord = index === array.length - 1;
                            
                            return (
                              <span
                                key={index}
                                onMouseDown={() => handleMouseDown(word.toLowerCase(), note.id)}
                                onMouseUp={handleMouseUp}
                                onClick={(e) => handleWordClick(word.toLowerCase(), e.currentTarget, index)}
                                style={{ 
                                  cursor: isQuizMode && isHighlighted ? 'pointer' : 'default',
                                  backgroundColor: isHighlighted ? 'yellow' : 'transparent',
                                  opacity: highlightedWords.has(word.toLowerCase()) ? 0.7 : 1,
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
                        </em>
                      );
                    },
                    blockquote: ({ children }) => {
                      if (typeof children !== 'string') {
                        return <blockquote className="border-l-4 border-gray-300 pl-4 my-2 italic">{children}</blockquote>;
                      }
                      return (
                        <blockquote className="border-l-4 border-gray-300 pl-4 my-2 italic">
                          {children.split(' ').map((word, index, array) => {
                            const isHighlighted = note.highlights.some(h => h.word === word.toLowerCase());
                            const shouldHide = isQuizMode && isHighlighted && !Array.from(revealedWords).some(r => r.word === word.toLowerCase() && r.index === index);
                            const isLastWord = index === array.length - 1;
                            
                            return (
                              <span
                                key={index}
                                onMouseDown={() => handleMouseDown(word.toLowerCase(), note.id)}
                                onMouseUp={handleMouseUp}
                                onClick={(e) => handleWordClick(word.toLowerCase(), e.currentTarget, index)}
                                style={{ 
                                  cursor: isQuizMode && isHighlighted ? 'pointer' : 'default',
                                  backgroundColor: isHighlighted ? 'yellow' : 'transparent',
                                  opacity: highlightedWords.has(word.toLowerCase()) ? 0.7 : 1,
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
                        </blockquote>
                      );
                    },
                    code: ({ children }) => <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{children}</code>,
                    pre: ({ children }) => <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded my-2 overflow-x-auto">{children}</pre>,
                  }}
                >
                  {note.content || ''}
                </ReactMarkdown>
              </div>
             
              {showResults && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <h3 className="text-lg font-semibold mb-2">Quiz Results</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-green-600">Correct Answers: {quizStats.correct}</p>
                      <p className="text-red-600">Wrong Answers: {quizStats.wrong}</p>
                    </div>
                    <div>
                      <p>Total Attempts: {quizStats.total}</p>
                      <p>Accuracy: {Math.round((quizStats.correct / quizStats.total) * 100)}%</p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => {
                      setShowResults(false);
                      setRevealedWords(new Set());
                      setQuizStats({ correct: 0, wrong: 0, total: 0 });
                    }}
                  >
                    Try Again
                  </Button>
                </div>
              )}
            </div>

            <div className="w-64 flex-shrink-0 border-l pl-4">
              <h3 className="text-lg font-semibold mb-4">Highlights</h3>
              <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-16rem)]">
                {note.highlights.map((highlight, index) => (
                  <div
                    key={index}
                    className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-md text-sm"
                  >
                    {highlight.word}
                  </div>
                ))}
                {note.highlights.length === 0 && (
                  <p className="text-muted-foreground text-sm">No highlights yet</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className='sticky bottom-0 bg-gray-100 pt-4 mt-4 border-t w-full'> <div className="w-full">
                <AIChatInput onResponse={handleAIResponse} />
              </div></CardFooter>
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