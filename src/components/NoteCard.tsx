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
  index: number;
  id: string;
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
  const [isQuizMode, setIsQuizMode] = useState(false);
  const [revealedWords, setRevealedWords] = useState<Set<string>>(new Set());
  const [quizStats, setQuizStats] = useState({ correct: 0, wrong: 0, total: 0 });
  const [showResults, setShowResults] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [hasAudio, setHasAudio] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [currentTypingText, setCurrentTypingText] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [selectedWord, setSelectedWord] = useState<{ word: string; index: number } | null>(null);
  const [quizOptions, setQuizOptions] = useState<QuizOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [wrongOptions, setWrongOptions] = useState<Set<string>>(new Set());

  // Generate a unique ID for a highlight
  const generateHighlightId = (word: string, index: number) => `${word}-${index}-${Date.now()}`;

  // Check if audio exists for the current content
  useEffect(() => {
    const checkAudio = async () => {
      if (!note.content) {
        setHasAudio(false);
        setAudioUrl(null);
        return;
      }

      const contentHash = crypto.createHash('md5').update(note.content).digest('hex');
      const metadata: AudioMetadata = {
        noteId: note.id,
        contentHash,
        timestamp: Date.now(),
        title: note.title
      };

      const cachedAudio = await audioStorage.getAudio(metadata);
      if (cachedAudio) {
        const url = URL.createObjectURL(cachedAudio);
        setAudioUrl(url);
        setHasAudio(true);
        if (audioRef.current) {
          audioRef.current.src = url;
        }
      } else {
        setHasAudio(false);
        setAudioUrl(null);
      }
    };

    checkAudio();

    // Cleanup function to revoke object URLs
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [note.content, note.id, note.title]);

  const handleWordClick = (word: string, index: number) => {
    if (isQuizMode) {
      const normalizedWord = word.toLowerCase();
      const isHighlighted = note.highlights.some(h => h.word === normalizedWord && h.index === index);
      const isHidden = isHighlighted && !revealedWords.has(`${normalizedWord}-${index}`);

      if (isHidden) {
        // Generate quiz options
        const correctWord = normalizedWord;
        const allWords = note.highlights.map(h => h.word);
        const uniqueWords = [...new Set(allWords)];
        
        // Get 3 random wrong answers
        const wrongOptions = uniqueWords
          .filter(w => w !== correctWord)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3);

        // Create quiz options with one correct and three wrong answers
        const options: QuizOption[] = [
          { word: correctWord, isCorrect: true },
          ...wrongOptions.map(word => ({ word, isCorrect: false }))
        ].sort(() => Math.random() - 0.5); // Shuffle options

        setQuizOptions(options);
        setSelectedWord({ word: normalizedWord, index });
      }
      return;
    }

    const normalizedWord = word.toLowerCase();
    const newHighlights = note.highlights.some(h => h.word === normalizedWord && h.index === index)
      ? note.highlights.filter(h => !(h.word === normalizedWord && h.index === index))
      : [...note.highlights, { word: normalizedWord, index, id: generateHighlightId(normalizedWord, index) }];

    onUpdate(note.id, note.content || '', newHighlights, note.title);
  };

  const handleQuizOptionClick = (option: QuizOption) => {
    if (!selectedWord) return;

    setSelectedOption(option.word);

    const newStats = { ...quizStats };
    newStats.total += 1;
    if (option.isCorrect) {
      newStats.correct += 1;
      setRevealedWords(prev => new Set([...prev, `${selectedWord.word}-${selectedWord.index}`]));
      // Reset after a short delay to show the correct answer
      setTimeout(() => {
        setSelectedWord(null);
        setSelectedOption(null);
        setWrongOptions(new Set());
      }, 1000);
    } else {
      newStats.wrong += 1;
      setQuizStats(newStats);
      setWrongOptions(prev => new Set([...prev, option.word]));
    }
  };

  const handleSave = async (id: string, title: string, content: string) => {
    try {
      // Process highlights on the backend
      const highlightResponse = await fetch('/api/notes/highlights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          content,
          highlights: note.highlights
        }),
      });

      if (!highlightResponse.ok) {
        throw new Error('Failed to process highlights');
      }

      const { highlights: updatedHighlights } = await highlightResponse.json();

      // Update the note with processed highlights
      onUpdate(id, content, updatedHighlights, title);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving note:', error);
      toast.error('Failed to save note');
    }
  };

  const renderWord = (word: string, index: number) => {
    const normalizedWord = word.toLowerCase();
    const isHighlighted = note.highlights.some(h => h.word === normalizedWord && h.index === index);
    const shouldHide = isQuizMode && isHighlighted && !revealedWords.has(`${normalizedWord}-${index}`);

    if (isQuizMode && isHighlighted && shouldHide) {
      return (
        <Popover key={`${word}-${index}`}>
          <PopoverTrigger asChild>
            <span
              className="cursor-pointer select-none px-0.5 mx-0.5 rounded text-transparent underline bg-yellow-200 dark:bg-yellow-800"
              onClick={() => {
                // Generate quiz options
                const correctWord = normalizedWord;
                const allWords = note.highlights.map(h => h.word);
                const uniqueWords = [...new Set(allWords)];
                
                // Get 3 random wrong answers
                const wrongOptions = uniqueWords
                  .filter(w => w !== correctWord)
                  .sort(() => Math.random() - 0.5)
                  .slice(0, 3);

                // Create quiz options with one correct and three wrong answers
                const options: QuizOption[] = [
                  { word: correctWord, isCorrect: true },
                  ...wrongOptions.map(word => ({ word, isCorrect: false }))
                ].sort(() => Math.random() - 0.5); // Shuffle options

                setQuizOptions(options);
                setSelectedWord({ word: normalizedWord, index });
                setSelectedOption(null);
                setWrongOptions(new Set());
              }}
            >
              {word}
            </span>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-4">
              <h4 className="font-medium">Select the correct word:</h4>
              <div className="grid grid-cols-2 gap-2">
                {quizOptions.map((option, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className={cn(
                      "w-full justify-start",
                      selectedOption === option.word && (
                        option.isCorrect 
                          ? "bg-green-100 border-green-500 text-green-700 dark:bg-green-900/30 dark:border-green-500 dark:text-green-400"
                          : "bg-red-100 border-red-500 text-red-700 dark:bg-red-900/30 dark:border-red-500 dark:text-red-400"
                      )
                    )}
                    onClick={() => handleQuizOptionClick(option)}
                    disabled={wrongOptions.has(option.word)}
                  >
                    {option.word}
                  </Button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      );
    }

    return (
      <span
        key={`${word}-${index}`}
        onClick={() => handleWordClick(word, index)}
        className={cn(
          "cursor-pointer select-none px-0.5 mx-0.5 rounded",
          isHighlighted && "bg-yellow-200 dark:bg-yellow-800",
          shouldHide && "text-transparent underline"
        )}
      >
        {word}
      </span>
    );
  };

  const renderContent = (content: string) => {
    // Split content into words while preserving markdown
    const words = content.split(/(\s+)/);
    return words.map((word, index) => {
      // Skip rendering for whitespace
      if (word.trim() === '') {
        return word;
      }
      return renderWord(word, index);
    });
  };

  const handleAIResponse = async (response: string) => {
    try {
      setIsTyping(true);
      setCurrentTypingText(note.content || ''); // Start with existing content
      
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
      
      // Create highlights from key terms, finding their positions in the content
      const words = (note.content || '').split(' ');
      const newHighlights = keyTerms
        .map((term: string) => {
          const normalizedTerm = term.toLowerCase();
          const index = words.findIndex((word, idx) => 
            word.toLowerCase() === normalizedTerm && 
            !note.highlights.some(h => h.index === idx)
          );
          return index !== -1 ? { 
            word: normalizedTerm, 
            index,
            id: generateHighlightId(normalizedTerm, index)
          } : null;
        })
        .filter((h: Highlight | null): h is Highlight => h !== null);

      // Combine existing highlights with new ones
      const updatedHighlights = [...note.highlights, ...newHighlights];

      // Format the response with proper spacing
      const formattedResponse = `\n\n---\n\n${response}`;

      // Type out the response word by word
      const wordsToType = formattedResponse.split(/(\s+)/);
      let currentText = note.content || '';
      
      for (const word of wordsToType) {
        await new Promise(resolve => setTimeout(resolve, 30)); // Slightly faster typing speed
        currentText += word;
        setCurrentTypingText(currentText);
      }

      // Update note with new content and highlights
      onUpdate(note.id, currentText, updatedHighlights, note.title);
    } catch (error) {
      console.error('Error extracting key terms:', error);
      toast.error('Failed to extract key terms');
      
      // Fallback to updating just the content without new highlights
      if (note.content) {
        onUpdate(note.id, note.content + '\n\n' + response, note.highlights, note.title);
      } else {
        onUpdate(note.id, response, note.highlights, note.title);
      }
    } finally {
      setIsTyping(false);
    }
  };

  const handleDelete = async () => {
    try {
      onDelete(note.id);
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Failed to delete note');
    }
  };

  const handleTTS = async () => {
    if (!note.content) return;

    try {
      setIsLoading(true);
      
      // Generate content hash
      const contentHash = crypto.createHash('md5').update(note.content).digest('hex');
      
      // Check if we have cached audio
      const metadata: AudioMetadata = {
        noteId: note.id,
        contentHash,
        timestamp: Date.now(),
        title: note.title
      };
      
      const cachedAudio = await audioStorage.getAudio(metadata);
      
      if (cachedAudio) {
        const url = URL.createObjectURL(cachedAudio);
        setAudioUrl(url);
        setHasAudio(true);
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.play();
          setIsPlaying(true);
        }
        return;
      }

      // Generate new audio
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

      if (!response.ok) {
        throw new Error('Failed to generate speech');
      }

      const audioBlob = await response.blob();
      
      // Cache the audio before creating URL
      await audioStorage.saveAudio(metadata, audioBlob);
      
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      setHasAudio(true);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('TTS error:', error);
      toast.error('Failed to generate speech');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayPause = () => {
    if (!audioRef.current || !audioUrl) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const handleRewind = () => {
    if (!audioRef.current) return;
    const newTime = Math.max(0, audioRef.current.currentTime - 5);
    audioRef.current.currentTime = newTime;
  };

  const handleForward = () => {
    if (!audioRef.current) return;
    const newTime = Math.min(audioRef.current.duration, audioRef.current.currentTime + 5);
    audioRef.current.currentTime = newTime;
  };

  // Add scroll to bottom function
  const scrollToBottom = () => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  };

  // Add effect to scroll when typing
  useEffect(() => {
    if (isTyping) {
      scrollToBottom();
    }
  }, [currentTypingText, isTyping]);

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
    <Card className="flex flex-col h-[calc(88vh-2rem)]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-bold">{note.title}</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant={isQuizMode ? "default" : "outline"}
            size="icon"
            onClick={() => {
              setIsQuizMode(!isQuizMode);
              if (!isQuizMode) {
                setRevealedWords(new Set());
                setQuizStats({ correct: 0, wrong: 0, total: 0 });
              }
            }}
          >
            <BookOpen className="h-4 w-4" />
          </Button>
          {!hasAudio ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleTTS}
              disabled={isLoading || !note.content}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRewind}
                disabled={!audioRef.current}
              >
                <Rewind className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePlayPause}
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleForward}
                disabled={!audioRef.current}
              >
                <FastForward className="h-4 w-4" />
              </Button>
            </div>
          )}
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
              <DropdownMenuItem onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <div className="flex gap-4 h-full">
          <div className="flex-1 overflow-y-auto" ref={contentRef}>
            <div className="prose prose-sm max-w-none dark:prose-invert pb-4">
              {note.content && (
                <div className="whitespace-pre-wrap">
                  {isTyping ? (
                    <>
                      {renderContent(currentTypingText)}
                      <span className="animate-pulse">▋</span>
                    </>
                  ) : (
                    renderContent(note.content)
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="w-64 flex-shrink-0 border-l pl-4">
            <h3 className="text-lg font-semibold mb-4">Highlights</h3>
            <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-16rem)]">
              {note.highlights.map((highlight) => (
                <div
                  key={highlight.id}
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
      <CardFooter className='sticky bottom-0 bg-gray-100 pt-4 mt-4 border-t w-full'>
        <div className="w-full">
          <AIChatInput onResponse={handleAIResponse} disabled={isTyping} />
        </div>
      </CardFooter>
      <audio
        ref={audioRef}
        onEnded={handleAudioEnded}
        className="hidden"
      />
    </Card>
  );
} 