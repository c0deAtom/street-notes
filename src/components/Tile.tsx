"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, Bold, Italic, Heading1, Heading2, List, ListOrdered, Save, Volume2, VolumeX, Loader2, Eye, EyeOff } from "lucide-react";
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

interface TileProps {
  id: string;
  title: string;
  content: string | null;
  position: number;
  onUpdate: (id: string, title: string, content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function Tile({ id, title, content, position, onUpdate, onDelete }: TileProps) {
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

  const handleDoubleClick = async (event: React.MouseEvent<HTMLDivElement>) => {
    if (isQuizMode || isEditing) return;

    const target = event.target as HTMLElement;
    if (target.tagName === 'MARK' || target.classList.contains('bg-yellow-200')) {
      // Get the text content before removing the highlight
      const text = target.textContent || '';
      
      // Create a text node to replace the highlighted element
      const textNode = document.createTextNode(text);
      target.parentNode?.replaceChild(textNode, target);

      // Get the updated HTML content
      const updatedContent = contentRef.current?.innerHTML || '';
      
      // Update editor content immediately for instant feedback
      editor?.commands.setContent(processContent(updatedContent));
      
      try {
        await onUpdate(id, title, updatedContent);
        toast({
          title: "Success",
          description: "Highlight removed",
        });
      } catch (error) {
        // Revert the change if the update fails
        const mark = document.createElement('mark');
        mark.className = 'bg-yellow-200';
        textNode.parentNode?.replaceChild(mark, textNode);
        mark.appendChild(document.createTextNode(text));
        
        editor?.commands.setContent(processContent(contentRef.current?.innerHTML || ''));
        
        toast({
          title: "Error",
          description: "Failed to remove highlight",
          variant: "destructive",
        });
      }
    } else {
      // Handle double-click to highlight
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;

      const range = selection.getRangeAt(0);
      const selectedText = selection.toString().trim();
      
      if (!selectedText) return;

      // Create a temporary span to highlight the selected text
      const span = document.createElement('mark');
      span.className = 'bg-yellow-200';
      range.surroundContents(span);

      // Get the updated HTML content
      const updatedContent = contentRef.current?.innerHTML || '';
      
      // Update editor content immediately for instant feedback
      editor?.commands.setContent(processContent(updatedContent));
      
      try {
        await onUpdate(id, title, updatedContent);
        toast({
          title: "Success",
          description: "Text highlighted",
        });
      } catch (error) {
        // Revert the change if the update fails
        const textNode = document.createTextNode(selectedText);
        span.parentNode?.replaceChild(textNode, span);
        
        editor?.commands.setContent(processContent(contentRef.current?.innerHTML || ''));
        
        toast({
          title: "Error",
          description: "Failed to highlight text",
          variant: "destructive",
        });
      }
    }
  };

  // Update processContent function to be more strict about highlight removal
  const processContent = (html: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Find all spans with bg-yellow-200 class and convert them to mark elements
    const highlightedSpans = doc.querySelectorAll('span.bg-yellow-200');
    highlightedSpans.forEach(span => {
      const mark = document.createElement('mark');
      mark.className = 'bg-yellow-200';
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

    return doc.body.innerHTML;
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

  const generateAudio = async () => {
    if (!content) return;
    
    try {
      setIsGeneratingAudio(true);
      
      // Create a content hash to check for existing audio
      const contentHash = await createContentHash(content);
      
      // Check localStorage for existing audio
      const savedAudio = localStorage.getItem(`audio_${id}`);
      if (savedAudio) {
        const { hash, url } = JSON.parse(savedAudio);
        if (hash === contentHash) {
          setAudioUrl(url);
          setIsGeneratingAudio(false);
          return;
        }
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
        throw new Error('Failed to generate audio');
      }

      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      
      // Save to localStorage with content hash
      localStorage.setItem(`audio_${id}`, JSON.stringify({
        hash: contentHash,
        url: url
      }));

      setAudioUrl(url);
      
      toast({
        title: "Success",
        description: "Audio generated successfully",
      });
    } catch (error) {
      console.error('Error generating audio:', error);
      toast({
        title: "Error",
        description: "Failed to generate audio",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // Helper function to create a content hash
  const createContentHash = async (content: string) => {
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
  };

  // Load existing audio when component mounts
  useEffect(() => {
    const loadExistingAudio = async () => {
      if (!content) return;
      
      const savedAudio = localStorage.getItem(`audio_${id}`);
      if (savedAudio) {
        const { hash, url } = JSON.parse(savedAudio);
        const currentHash = await createContentHash(content);
        
        if (hash === currentHash) {
          setAudioUrl(url);
        } else {
          // Content has changed, cleanup old audio
          URL.revokeObjectURL(url);
          localStorage.removeItem(`audio_${id}`);
        }
      }
    };

    loadExistingAudio();
  }, [content, id]);

  // Cleanup audio when content changes or component unmounts
  useEffect(() => {
    return () => {
      // Cleanup audio URL
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [audioUrl]);

  // Cleanup old audio when content changes
  useEffect(() => {
    const cleanupOldAudio = async () => {
      if (!content) return;
      
      const savedAudio = localStorage.getItem(`audio_${id}`);
      if (savedAudio) {
        const { hash, url } = JSON.parse(savedAudio);
        const currentHash = await createContentHash(content);
        
        if (hash !== currentHash) {
          // Content has changed, cleanup old audio
          URL.revokeObjectURL(url);
          localStorage.removeItem(`audio_${id}`);
          setAudioUrl(null);
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
          }
        }
      }
    };

    cleanupOldAudio();
  }, [content, id]);

  const togglePlayback = () => {
    if (!audioUrl) {
      generateAudio();
      return;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setIsPlaying(false);
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

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
    return colors[position % colors.length];
  };

  return (
    <Card className={`max-h-[700px] ${getTileColor(position)}`}>
      <CardHeader className="flex flex-row items-center justify-between">
        {isEditing ? (
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="flex-1 mr-2"
          />
        ) : (
          <CardTitle>{title}</CardTitle>
        )}
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
              >
                Save
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={togglePlayback}
                      disabled={isGeneratingAudio}
                    >
                      {isGeneratingAudio ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isPlaying ? (
                        <VolumeX className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isGeneratingAudio ? "Generating audio..." : isPlaying ? "Stop playback" : "Play audio"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsQuizMode(!isQuizMode)}
                    >
                      {isQuizMode ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isQuizMode ? "Exit Quiz Mode" : "Enter Quiz Mode"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                variant="outline"
                size="sm"
                onClick={handleEditClick}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 overflow-y-auto">
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
            </div>
            <div className="prose prose-sm max-w-none min-h-[200px] border rounded-md p-4 break-words whitespace-pre-wrap overflow-x-hidden max-w-100">
              <EditorContent editor={editor} />
            </div>
          </div>
        ) : (
          <>
            {!isQuizMode && (
              <>
                <div 
                  ref={contentRef}
                  className="prose prose-sm max-w-none cursor-pointer"
                  onClick={handleWordClick}
                  onDoubleClick={handleDoubleClick}
                  dangerouslySetInnerHTML={{ __html: processContent(content || '') }}
                />
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
                    <div className="flex gap-2 justify-end">
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
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit Response
                        </Button>
                      )}
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleSaveAIResponse}
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
                  className="prose prose-sm max-w-none cursor-pointer"
                  onClick={handleWordClick}
                  onDoubleClick={handleDoubleClick}
                  dangerouslySetInnerHTML={{ __html: processQuizContent(processContent(content || '')) }}
                />
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
        {!isEditing && (
        
            <AIChatInput onResponse={handleAIResponse} disabled={isTyping} />
       
        )}
      </CardContent>
    </Card>
  );
} 