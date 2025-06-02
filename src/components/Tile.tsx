"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, Bold, Italic, Heading1, Heading2, List, ListOrdered, Save, Volume2, VolumeX, Loader2, Eye, EyeOff, AlertCircle, Brain, X, BotMessageSquare } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import { Toggle } from "@/components/ui/toggle";
import { AIChatInput } from "@/components/AIChatInput";
import { audioStorage } from "@/lib/audioStorage";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { assignUniqueIDsToMarks } from "@/lib/utils";
import type { Tile } from '@/types';

interface TileProps {
  id: string;
  title: string;
  content: string | null;
  position: number;
  onUpdate: (id: string, title: string, content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isFocused: boolean;
  isDeleting?: boolean;
}

export function Tile({ id, title, content, position, onUpdate, onDelete, isFocused, isDeleting = false }: TileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [isTyping, setIsTyping] = useState(false);
  const [currentTypingContent, setCurrentTypingContent] = useState("");
  const [pendingAIResponse, setPendingAIResponse] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [isEditingAIResponse, setIsEditingAIResponse] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [isQuizMode, setIsQuizMode] = useState(false);
  const [quizOptions, setQuizOptions] = useState<{
    word: string;
    options: string[];
    correctIndex: number;
    selectedIndex: number | null;
  } | null>(null);
  const [revealedWords, setRevealedWords] = useState<Set<string>>(new Set());
  const [isAudioError, setIsAudioError] = useState(false);
  const [highlightedWords, setHighlightedWords] = useState<string[]>([]);
  const [isAIInputExpanded, setIsAIInputExpanded] = useState(false);
  const [showMobileHighlights, setShowMobileHighlights] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight.configure({ multicolor: true }),
    ],
    content: content || '',
    onUpdate: ({ editor }) => {
      // Handle content updates
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none',
      },
    },
    immediatelyRender: false,
  });

  const aiResponseEditor = useEditor({
    extensions: [
      StarterKit,
      Highlight.configure({ multicolor: true }),
    ],
    content: currentTypingContent,
    onUpdate: ({ editor }) => {
      setCurrentTypingContent(editor.getHTML());
      setPendingAIResponse(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none',
      },
    },
    immediatelyRender: false,
  });

  // Update AI response editor content when currentTypingContent changes
  useEffect(() => {
    if (aiResponseEditor && currentTypingContent) {
      aiResponseEditor.commands.setContent(currentTypingContent);
    }
  }, [aiResponseEditor, currentTypingContent]);

  // Update editor content when content prop changes or when switching to edit mode
  useEffect(() => {
    if (editor && content) {
      const processedContent = processContent(content);
      editor.commands.setContent(processedContent);
    }
  }, [editor, content, isEditing]);

  const handleSave = async () => {
    try {
      const content = editor?.getHTML() || '';
      await onUpdate(id, editTitle, content);
      setIsEditing(false);
      if (editor) {
        const processedContent = processContent(content);
        editor.commands.setContent(processedContent);
      }
      if (contentRef.current) {
        contentRef.current.innerHTML = processContent(content);
      }
      updateHighlightedWords();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update tile",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setEditTitle(title);
    editor?.commands.setContent(content || '');
    setIsEditing(false);
    if (contentRef.current) {
      contentRef.current.innerHTML = processContent(content || '');
    }
    updateHighlightedWords();
  };

  const toggleHighlight = useCallback(() => {
    editor?.chain().focus().toggleHighlight().run();
  }, [editor]);

  const isHighlighted = editor?.isActive('highlight');

  const handleWordClick = async (event: React.MouseEvent<HTMLDivElement>) => {
    // Don't allow highlighting in quiz mode
    if (isQuizMode) return;
    
    if (isEditing) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();
    
    if (!selectedText) return;

    // Don't clear the selection, let it remain selected
  };

  // Utility to assign unique highlight IDs per tile
  function assignTileHighlightIDs(html: string, tileId: string): string {
    if (!html) return html;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const marks = doc.querySelectorAll('mark');
    marks.forEach((mark, idx) => {
      mark.id = `highlight-${tileId}-${idx}`;
    });
    return doc.body.innerHTML;
  }

  const processContent = (html: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    // Find all spans with bg-yellow-200 class and convert them to mark elements
    const highlightedSpans = doc.querySelectorAll('span.bg-yellow-200');
    highlightedSpans.forEach((span, index) => {
      const mark = document.createElement('mark');
      mark.className = 'bg-yellow-200';
      mark.id = `highlight-${id}-${index}`;
      span.parentNode?.replaceChild(mark, span);
      while (span.firstChild) {
        mark.appendChild(span.firstChild);
      }
    });
    // Remove any duplicate mark elements
    const marks = doc.querySelectorAll('mark');
    marks.forEach(mark => {
      if (mark.parentElement?.tagName === 'MARK') {
        const text = mark.textContent || '';
        const textNode = document.createTextNode(text);
        mark.parentElement.parentNode?.replaceChild(textNode, mark.parentElement);
      }
    });
    return assignTileHighlightIDs(doc.body.innerHTML, id);
  };

  const handleEditClick = () => {
    // Process content before switching to edit mode
    if (contentRef.current) {
      const processedContent = processContent(contentRef.current.innerHTML);
      editor?.commands.setContent(processedContent);
    }
    setIsEditing(true);
  };

  const typeWriter = async (text: string) => {
    setIsTyping(true);
    setShowPreview(true);
    const words = text.split(/(<[^>]*>.*?<\/[^>]*>|\s+)/);
    
    for (const word of words) {
      if (word.trim()) {
        // Calculate typing speed based on word length and type
        let speed = 100; // Base speed for regular words
        
        if (word.startsWith('<h')) {
          // Headers type slower
          speed = 150;
        } else if (word.startsWith('<strong>') || word.startsWith('<em>')) {
          // Emphasized text types slightly slower
          speed = 120;
        } else if (word.startsWith('<li>')) {
          // List items have a slight pause
          speed = 130;
        } else if (word.startsWith('<p>')) {
          // Paragraphs have a longer pause
          speed = 200;
        } else if (word.length > 10) {
          // Longer words type slower
          speed = 120;
        }

        // Add a small random variation to make it feel more natural
        speed += Math.random() * 50;

        setCurrentTypingContent(prev => prev + word);
        // Scroll to bottom after content update
        setTimeout(() => {
          const aiResponseDiv = document.querySelector('.ai-response-content');
          if (aiResponseDiv) {
            aiResponseDiv.scrollTop = aiResponseDiv.scrollHeight;
          }
        }, 0);
        await new Promise(resolve => setTimeout(resolve, speed));
      } else {
        // For whitespace and HTML tags, add a small delay
        setCurrentTypingContent(prev => prev + word);
        // Scroll to bottom after content update
        setTimeout(() => {
          const aiResponseDiv = document.querySelector('.ai-response-content');
          if (aiResponseDiv) {
            aiResponseDiv.scrollTop = aiResponseDiv.scrollHeight;
          }
        }, 0);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    setIsTyping(false);
  };

  const handleAIResponse = async (response: string) => {
    try {
      setCurrentTypingContent("");
      setPendingAIResponse(response);
      await typeWriter(response);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process AI response",
        variant: "destructive",
      });
    }
  };

  const handleEditAIResponse = () => {
    setIsEditingAIResponse(true);
  };

  const handleSaveAIResponse = async () => {
    try {
      if (isEditing) {
        // If in edit mode, insert the AI response at the cursor position
        editor?.chain().focus().insertContent(pendingAIResponse).run();
      } else {
        // If in view mode, append the AI response to the existing content
        const currentContent = contentRef.current?.innerHTML || '';
        // Add spacing between content
        const spacing = '<div class="h-px bg-border my-8"></div>';
        const newContent = currentContent + spacing + pendingAIResponse;
        await onUpdate(id, title, newContent);
        // Update the editor content if it exists
        editor?.commands.setContent(processContent(newContent));
      }
      setPendingAIResponse("");
      setCurrentTypingContent("");
      setShowPreview(false);
      setIsEditingAIResponse(false);
      toast({
        title: "Success",
        description: "AI response saved successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save AI response",
        variant: "destructive",
      });
    }
  };

  const handleDiscardAIResponse = () => {
    setPendingAIResponse("");
    setCurrentTypingContent("");
    setShowPreview(false);
    setIsEditingAIResponse(false);
  };

  const handleAudioError = async () => {
    try {
      // Clear all audio data
      await audioStorage.clearAll();
      // Reset audio state
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      setIsAudioError(false);
      toast({
        title: "Audio storage reset",
        description: "Audio storage has been reset. Please try again.",
      });
    } catch (error) {
      console.error('Error resetting audio storage:', error);
      toast({
        title: "Error",
        description: "Failed to reset audio storage. Please refresh the page.",
        variant: "destructive",
      });
    }
  };

  const generateAudio = async () => {
    if (!content) return;
    
    try {
      setIsGeneratingAudio(true);
      setIsAudioError(false);
      
      // Create a content hash to check for existing audio
      const contentHash = await createContentHash(content);
      
      // Check IndexedDB for existing audio
      const audioBlob = await audioStorage.getAudio({
        noteId: id,
        contentHash,
        timestamp: Date.now(),
        title
      });

      if (audioBlob) {
        // Cleanup old audio URL if it exists
        if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
        }
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        setIsGeneratingAudio(false);
        return;
      }

      // Generate new audio only if content has changed
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: content,
          noteId: id
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to generate audio' }));
        throw new Error(error.detail || 'Failed to generate audio');
      }

      const newAudioBlob = await response.blob();
      
      // Cleanup old audio URL if it exists
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      
      const url = URL.createObjectURL(newAudioBlob);
      
      // Save to IndexedDB
      await audioStorage.saveAudio({
        noteId: id,
        contentHash,
        timestamp: Date.now(),
        title
      }, newAudioBlob);

      setAudioUrl(url);
      
      toast({
        title: "Success",
        description: "Audio generated successfully",
      });
    } catch (error) {
      console.error('Error generating audio:', error);
      // Check if it's a database error
      if (error instanceof Error && error.message.includes('index')) {
        setIsAudioError(true);
        toast({
          title: "Database Error",
          description: "There was an error with the audio storage. Click to reset.",
          action: (
            <Button variant="outline" size="sm" onClick={handleAudioError}>
              Reset Storage
            </Button>
          ),
          variant: "destructive",
        });
      } else {
        // Cleanup on error
        if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
          setAudioUrl(null);
        }
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = '';
          audioRef.current = null;
        }
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to generate audio",
          variant: "destructive",
        });
      }
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // Helper function to create a content hash
  const createContentHash = async (content: string) => {
    try {
      // Create a temporary div to parse HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;
      
      // Get only the text content, ignoring HTML tags
      const textContent = tempDiv.textContent || '';
      
      const encoder = new TextEncoder();
      const data = encoder.encode(textContent);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.error('Error creating content hash:', error);
      // Return a timestamp-based hash as fallback
      return Date.now().toString(36);
    }
  };

  // Load existing audio when component mounts
  useEffect(() => {
    const loadExistingAudio = async () => {
      if (!content) return;
      
      const contentHash = await createContentHash(content);
      const audioBlob = await audioStorage.getAudio({
        noteId: id,
        contentHash,
        timestamp: Date.now(),
        title
      });
      
      if (audioBlob) {
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
      }
    };

    loadExistingAudio();
  }, [content, id, title]);

  const togglePlayback = () => {
    if (!audioUrl) {
      generateAudio();
      return;
    }

    try {
      if (!audioRef.current) {
        audioRef.current = new Audio(audioUrl);
        audioRef.current.onended = () => {
          setIsPlaying(false);
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
          }
        };
        audioRef.current.onerror = (error) => {
          console.error('Audio playback error:', error);
          setIsPlaying(false);
          setAudioUrl(null);
          toast({
            title: "Error",
            description: "Failed to play audio. Please try generating it again.",
            variant: "destructive",
          });
        };
      }

      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().catch((error) => {
          console.error('Error playing audio:', error);
          setIsPlaying(false);
          setAudioUrl(null);
          toast({
            title: "Error",
            description: "Failed to play audio. Please try generating it again.",
            variant: "destructive",
          });
        });
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error in togglePlayback:', error);
      setIsPlaying(false);
      setAudioUrl(null);
      toast({
        title: "Error",
        description: "Failed to play audio. Please try generating it again.",
        variant: "destructive",
      });
    }
  };

  // Cleanup audio when content changes or component unmounts
  useEffect(() => {
    return () => {
      try {
        // Cleanup audio URL
        if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
        }
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = '';
          audioRef.current = null;
        }
      } catch (error) {
        console.error('Error cleaning up audio:', error);
      }
    };
  }, [audioUrl]);

  // Cleanup old audio when content changes
  useEffect(() => {
    const cleanupOldAudio = async () => {
      if (!content) return;
      
      try {
        const contentHash = await createContentHash(content);
        const audioBlob = await audioStorage.getAudio({
          noteId: id,
          contentHash,
          timestamp: Date.now(),
          title
        });
        
        if (!audioBlob) {
          // Content has changed, cleanup old audio
          if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
            setAudioUrl(null);
          }
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
            audioRef.current = null;
          }
        }
      } catch (error) {
        console.error('Error cleaning up old audio:', error);
        // Reset audio state on error
        if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
          setAudioUrl(null);
        }
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = '';
          audioRef.current = null;
        }
      }
    };

    cleanupOldAudio();
  }, [content, id, title]);

  // Function to generate quiz options
  const generateQuizOptions = (word: string) => {
    // Generate 3 random words that are different from the correct word
    const words = content?.split(/\s+/) || [];
    const otherWords = words.filter(w => w !== word && !w.includes('<'));
    const randomWords = otherWords
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    // Insert correct answer at random position
    const correctIndex = Math.floor(Math.random() * 4);
    const options = [...randomWords];
    options.splice(correctIndex, 0, word);

    return {
      word,
      options,
      correctIndex,
      selectedIndex: null
    };
  };

  // Function to handle word click in quiz mode
  const handleQuizWordClick = (word: string) => {
    if (revealedWords.has(word)) return;
    setQuizOptions(generateQuizOptions(word));
  };

  // Function to handle option selection
  const handleOptionSelect = (index: number) => {
    if (!quizOptions) return;

    setQuizOptions(prev => {
      if (!prev) return null;
      return { ...prev, selectedIndex: index };
    });

    if (index === quizOptions.correctIndex) {
      setRevealedWords(prev => new Set([...prev, quizOptions.word]));
      toast({
        title: "Correct!",
        description: "You got it right!",
      });
    } else {
      toast({
        title: "Incorrect",
        description: "Try again!",
        variant: "destructive",
      });
    }
  };

  // Function to process content for quiz mode
  const processQuizContent = (html: string) => {
    if (!isQuizMode) return html;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Find all highlighted words
    const highlightedWords = doc.querySelectorAll('mark');
    highlightedWords.forEach(mark => {
      const word = mark.textContent || '';
      if (!revealedWords.has(word)) {
        mark.innerHTML = '_____';
        mark.className = 'cursor-pointer hover:bg-yellow-100 transition-colors';
        mark.onclick = () => handleQuizWordClick(word);
      }
    });

    return doc.body.innerHTML;
  };

  // Reset quiz mode when content changes
  useEffect(() => {
    if (!isQuizMode) {
      setRevealedWords(new Set());
      setQuizOptions(null);
    }
  }, [isQuizMode, content]);

  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      // Cleanup audio
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      // Reset all state
      setIsEditing(false);
      setIsTyping(false);
      setCurrentTypingContent("");
      setPendingAIResponse("");
      setShowPreview(false);
      setIsEditingAIResponse(false);
      setIsGeneratingAudio(false);
      setIsPlaying(false);
      setAudioUrl(null);
      setQuizOptions(null);
      setRevealedWords(new Set());

      // Destroy editors
      editor?.destroy();
      aiResponseEditor?.destroy();
    };
  }, []);

  const getTileColor = (position: number) => {
    const colors = [
      'bg-green-50',
      'bg-yellow-50',
      'bg-blue-50',
      'bg-pink-50',
      'bg-purple-50'
    ];
    // Use modulo to cycle through colors
    return colors[Math.abs(position) % colors.length];
  };

  const updateHighlightedWords = () => {
    const contentHTML = contentRef.current?.innerHTML || '';
    const parser = new DOMParser();
    const doc = parser.parseFromString(contentHTML, 'text/html');
    const marks = doc.querySelectorAll('mark');
    const words = Array.from(marks).map(mark => mark.textContent || '').filter(Boolean);
    setHighlightedWords(words);
  };

  useEffect(() => {
    updateHighlightedWords();
  }, [content]);

  // Update highlighted words when content changes
  useEffect(() => {
    if (isEditing) {
      updateHighlightedWords();
    }
  }, [isEditing, content]);

  // Update scrollToHighlight to use the new ID format
  const scrollToHighlight = (highlightId: string) => {
    const element = document.getElementById(`highlight-${id}-${highlightId}`) || document.getElementById(highlightId);
    const container = element?.closest('.overflow-y-auto');
    if (element && container) {
      const elementPosition = element.offsetTop;
      const containerHeight = container.clientHeight;
      const elementHeight = element.clientHeight;
      const offset = elementPosition - (containerHeight / 2) + (elementHeight / 2);
      container.scrollTo({ top: offset, behavior: 'smooth' });
      element.style.boxShadow = '0 0 0 3px #ef4444'; // red-500
      element.style.borderRadius = '4px';
      setTimeout(() => {
        element.style.boxShadow = '';
      }, 2000);
    }
  };

  // Function to toggle the AI input field
  const toggleAIInput = () => {
    setIsAIInputExpanded(!isAIInputExpanded);
  };

  // Restore handleDoubleClick, but update to use reassignMarkIDs with highlight-${id}-${idx}
  const handleDoubleClick = async (event: React.MouseEvent<HTMLDivElement>) => {
    if (isQuizMode || isEditing) return;
    const target = event.target as HTMLElement;
    if (target.tagName === 'MARK' || target.classList.contains('bg-yellow-200')) {
      // Remove highlight
      const text = target.textContent || '';
      const textNode = document.createTextNode(text);
      target.parentNode?.replaceChild(textNode, target);
      let updatedContent = contentRef.current?.innerHTML || '';
      updatedContent = assignTileHighlightIDs(updatedContent, id);
      editor?.commands.setContent(updatedContent);
      try {
        await onUpdate(id, title, updatedContent);
        toast({ title: 'Success', description: 'Highlight removed' });
      } catch (error) {
        // Revert the change if the update fails
        const mark = document.createElement('mark');
        mark.className = 'bg-yellow-200';
        textNode.parentNode?.replaceChild(mark, textNode);
        mark.appendChild(document.createTextNode(text));
        let revertedContent = contentRef.current?.innerHTML || '';
        revertedContent = assignTileHighlightIDs(revertedContent, id);
        editor?.commands.setContent(revertedContent);
        toast({ title: 'Error', description: 'Failed to remove highlight', variant: 'destructive' });
      }
    } else {
      // Add highlight
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;
      const range = selection.getRangeAt(0);
      const selectedText = selection.toString().trim();
      if (!selectedText) return;
      const span = document.createElement('mark');
      
      range.surroundContents(span);
      let updatedContent = contentRef.current?.innerHTML || '';
      updatedContent = assignTileHighlightIDs(updatedContent, id);
      editor?.commands.setContent(updatedContent);
      try {
        await onUpdate(id, title, updatedContent);
        toast({ title: 'Success', description: 'Text highlighted' });
      } catch (error) {
        const textNode = document.createTextNode(selectedText);
        span.parentNode?.replaceChild(textNode, span);
        let revertedContent = contentRef.current?.innerHTML || '';
        revertedContent = assignTileHighlightIDs(revertedContent, id);
        editor?.commands.setContent(revertedContent);
        toast({ title: 'Error', description: 'Failed to highlight text', variant: 'destructive' });
      }
    }
  };

  return (
    <Card className={`relative max-h-[700px]  ${getTileColor(position)} ${isFocused ? 'ring-1  ring-offset-1 ' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {isEditing ? (
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              className="h-7"
            />
          ) : (
            <div
              className="cursor-pointer"
              onDoubleClick={() => setIsEditing(true)}
            >
                <div className="text-lg font-medium">{title}</div>
              
            </div>
          )}
        </CardTitle>
      

        <div className="flex items-center gap-2">
          {isFocused && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={togglePlayback}
                disabled={isGeneratingAudio || isDeleting}
              >
                {isGeneratingAudio ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsQuizMode(!isQuizMode)}
                disabled={isDeleting}
              >
                {isQuizMode ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleEditClick}
                disabled={isDeleting}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onDelete(id)}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </>
          )}
        </div>
        

      </CardHeader>
      <hr className=" border-t border-gray-300" />
      
      
      <CardContent className={`space-y-4  ${isFocused ? 'overflow-y-auto max-h-[500px]' : 'overflow-hidden '}`}>
        {isEditing ? (
          <div className="space-y-4">
            <div className="flex gap-2 p-2 border rounded-md">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Toggle
                      size="sm"
                      pressed={editor?.isActive('bold')}
                      onPressedChange={() => editor?.chain().focus().toggleBold().run()}
                    >
                      <Bold className="h-4 w-4" />
                    </Toggle>
                  </TooltipTrigger>
                  <TooltipContent>Bold</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Toggle
                      size="sm"
                      pressed={editor?.isActive('italic')}
                      onPressedChange={() => editor?.chain().focus().toggleItalic().run()}
                    >
                      <Italic className="h-4 w-4" />
                    </Toggle>
                  </TooltipTrigger>
                  <TooltipContent>Italic</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Toggle
                      size="sm"
                      pressed={editor?.isActive('heading', { level: 1 })}
                      onPressedChange={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                    >
                      <Heading1 className="h-4 w-4" />
                    </Toggle>
                  </TooltipTrigger>
                  <TooltipContent>Heading 1</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Toggle
                      size="sm"
                      pressed={editor?.isActive('heading', { level: 2 })}
                      onPressedChange={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                    >
                      <Heading2 className="h-4 w-4" />
                    </Toggle>
                  </TooltipTrigger>
                  <TooltipContent>Heading 2</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Toggle
                      size="sm"
                      pressed={editor?.isActive('bulletList')}
                      onPressedChange={() => editor?.chain().focus().toggleBulletList().run()}
                    >
                      <List className="h-4 w-4" />
                    </Toggle>
                  </TooltipTrigger>
                  <TooltipContent>Bullet List</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Toggle
                      size="sm"
                      pressed={editor?.isActive('orderedList')}
                      onPressedChange={() => editor?.chain().focus().toggleOrderedList().run()}
                    >
                      <ListOrdered className="h-4 w-4" />
                    </Toggle>
                  </TooltipTrigger>
                  <TooltipContent>Numbered List</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Toggle
                      size="sm"
                      pressed={isHighlighted}
                      onPressedChange={toggleHighlight}
                    >
                      <span className="h-4 w-4 bg-yellow-200 rounded-sm">H</span>
                    </Toggle>
                  </TooltipTrigger>
                  <TooltipContent>Highlight</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <div className="h-4 w-px bg-border mx-2" />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                className="h-8"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleSave}
                className="h-8"
              >
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
            <div className="prose prose-sm max-w-none min-h-[200px] border rounded-md p-4 break-words whitespace-pre-wrap overflow-x-hidden max-w-100">
              <EditorContent editor={editor} />
            </div>
          </div>
        ) : (
          <>
            {!isQuizMode && (
              <>
              <div className="flex items-top justify-between">
                <div 
                  ref={contentRef}
                  className={`prose prose-sm max-w-280 overflow-y-auto max-h-[400px]  ${isFocused ? 'cursor-pointer' : 'cursor-default'}`}
                  onClick={handleWordClick}
                  onDoubleClick={handleDoubleClick}
                  dangerouslySetInnerHTML={{ __html: processContent(content || '') }}
                />
                 {/* Display highlighted words on the right side, hidden on small screens */}
                 <div className={`hidden md:block absolute right-4 top-20  mr-2  border rounded-md p-2 ${getTileColor(position)} shadow  w-40  ${isFocused ? 'max-h-[400px] overflow-y-auto' : 'max-h-[200px] overflow-y-auto'}` }>
  <ul className="list-disc pl-4 space-y-1">
    {highlightedWords.map((word, index) => (
      <li key={index}>
        <button onClick={() => scrollToHighlight(`${index}`)} className="text-blue-500 hover:underline focus:outline-none">
          {word}
        </button>
      </li>
    ))}
  </ul>
        </div>
        </div>
        
                {!isFocused && content && content.length > 500 && (
                  <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent" />
                )}
                {showPreview && (
                  <div className="space-y-2">
                    <div className="h-px bg-border my-4" />
                    {isEditingAIResponse ? (
                      <div className="space-y-4">
                        <div className="flex gap-2 p-2 border rounded-md">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Toggle
                                  size="sm"
                                  pressed={aiResponseEditor?.isActive('bold')}
                                  onPressedChange={() => aiResponseEditor?.chain().focus().toggleBold().run()}
                                >
                                  <Bold className="h-4 w-4" />
                                </Toggle>
                              </TooltipTrigger>
                              <TooltipContent>Bold</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Toggle
                                  size="sm"
                                  pressed={aiResponseEditor?.isActive('italic')}
                                  onPressedChange={() => aiResponseEditor?.chain().focus().toggleItalic().run()}
                                >
                                  <Italic className="h-4 w-4" />
                                </Toggle>
                              </TooltipTrigger>
                              <TooltipContent>Italic</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Toggle
                                  size="sm"
                                  pressed={aiResponseEditor?.isActive('heading', { level: 1 })}
                                  onPressedChange={() => aiResponseEditor?.chain().focus().toggleHeading({ level: 1 }).run()}
                                >
                                  <Heading1 className="h-4 w-4" />
                                </Toggle>
                              </TooltipTrigger>
                              <TooltipContent>Heading 1</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Toggle
                                  size="sm"
                                  pressed={aiResponseEditor?.isActive('heading', { level: 2 })}
                                  onPressedChange={() => aiResponseEditor?.chain().focus().toggleHeading({ level: 2 }).run()}
                                >
                                  <Heading2 className="h-4 w-4" />
                                </Toggle>
                              </TooltipTrigger>
                              <TooltipContent>Heading 2</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Toggle
                                  size="sm"
                                  pressed={aiResponseEditor?.isActive('bulletList')}
                                  onPressedChange={() => aiResponseEditor?.chain().focus().toggleBulletList().run()}
                                >
                                  <List className="h-4 w-4" />
                                </Toggle>
                              </TooltipTrigger>
                              <TooltipContent>Bullet List</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Toggle
                                  size="sm"
                                  pressed={aiResponseEditor?.isActive('orderedList')}
                                  onPressedChange={() => aiResponseEditor?.chain().focus().toggleOrderedList().run()}
                                >
                                  <ListOrdered className="h-4 w-4" />
                                </Toggle>
                              </TooltipTrigger>
                              <TooltipContent>Numbered List</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Toggle
                                  size="sm"
                                  pressed={aiResponseEditor?.isActive('highlight')}
                                  onPressedChange={() => aiResponseEditor?.chain().focus().toggleHighlight().run()}
                                >
                                  <span className="h-4 w-4 bg-yellow-200 rounded-sm">H</span>
                                </Toggle>
                              </TooltipTrigger>
                              <TooltipContent>Highlight</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <div className="prose prose-sm max-w-none">
                          <EditorContent editor={aiResponseEditor} />
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="prose prose-sm max-w-none p-4 bg-muted/50 rounded-lg max-h-[400px] overflow-y-auto ai-response-content"
                        dangerouslySetInnerHTML={{ __html: currentTypingContent }}
                      />
                    )}
                    <div className="flex gap-2 justify-start">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDiscardAIResponse}
                      >
                        Discard
                      </Button>
                      {!isEditingAIResponse && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleEditAIResponse}
                          disabled={isTyping}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit Response
                        </Button>
                      )}
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleSaveAIResponse}
                        disabled={isTyping}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save Response
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
            {isQuizMode && (
              <>
                <div 
                  ref={contentRef}
                  className={`prose prose-sm max-w-none ${isFocused ? 'cursor-pointer' : 'cursor-default'} ${
                    !isFocused ? 'max-h-[200px] overflow-hidden' : ''
                  }`}
                  onClick={handleWordClick}
                  onDoubleClick={handleDoubleClick}
                  dangerouslySetInnerHTML={{ __html: processQuizContent(processContent(content || '')) }}
                />
                {!isFocused && content && content.length > 500 && (
                  <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent" />
                )}
                <Dialog open={!!quizOptions} onOpenChange={() => setQuizOptions(null)}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Choose the correct word</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-2">
                      {quizOptions?.options.map((option, index) => (
                        <Button
                          key={index}
                          variant={quizOptions.selectedIndex === index ? 
                            (index === quizOptions.correctIndex ? "default" : "destructive") : 
                            "outline"}
                          onClick={() => handleOptionSelect(index)}
                          disabled={quizOptions.selectedIndex !== null}
                        >
                          {option}
                        </Button>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </>
        )}
       
        {/* Mobile: Show button to open highlights list */}
        <div className="block md:hidden mt-2">
            <div className="absolute top-19 right-4">
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2 "
            onClick={() => setShowMobileHighlights((v) => !v)}
          >
            <List className="h-4 w-4" />
            H
          </Button>
          </div>
          {/* Slide-in panel for highlights */}
          {showMobileHighlights && (
            <div
              className="fixed top-0 right-0 h-full w-64 bg-background shadow-lg z-[200] border-l flex flex-col p-4 transition-transform duration-300"
              style={{ transform: showMobileHighlights ? 'translateX(0)' : 'translateX(100%)' }}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">Highlighted Words</span>
                <Button size="icon" variant="ghost" onClick={() => setShowMobileHighlights(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <ul className="list-disc pl-4 space-y-1 overflow-y-auto flex-1">
                {highlightedWords.length === 0 ? (
                  <li className="text-muted-foreground text-sm">No highlights</li>
                ) : (
                  highlightedWords.map((word, index) => (
                    <li key={index}>
                      <button
                        onClick={() => {
                          scrollToHighlight(`${index}`);
                          setShowMobileHighlights(false);
                          console.log('clicked', word);
                        }}
                        className="text-blue-500 hover:underline focus:outline-none text-left"
                      >
                        {word}
                      </button>
                    </li>
                    
                  ))
                )}
              </ul>
            </div>
          )}
          {/* Overlay to close on outside click */}
          {showMobileHighlights && (
            <div
              className="fixed inset-0 z-[199] bg-black/10"
              onClick={() => setShowMobileHighlights(false)}
            />
          )}
        </div>
      </CardContent>
     <CardFooter> {!isEditing && isFocused && (
          <div className="">
            <div className={`absolute bottom-2 right-2 p-3 ${getTileColor(position)}`}>
              <Button
                variant="outline"
                size="icon"
                onClick={toggleAIInput}
                className="rounded-full h-12 w-12 shadow-lg"
              >
             <BotMessageSquare className="h-6 w-6" />
              </Button>
            </div>
            {isAIInputExpanded && (
              <div className="absolute bottom-0 right-20 p-3 transition-all duration-300 ease-in-out">
                <AIChatInput onResponse={handleAIResponse} disabled={isTyping} />
              </div>
            )}
          </div>
        )}
        </CardFooter>
    </Card>
  );
} 