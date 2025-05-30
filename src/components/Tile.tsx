"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, Bold, Italic, Heading1, Heading2, List, ListOrdered, Save } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import { Toggle } from "@/components/ui/toggle";
import { AIChatInput } from "@/components/AIChatInput";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  const contentRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight.configure({ multicolor: true }),
    ],
    content: content || '',
    onUpdate: ({ editor }) => {
      // Handle content updates
    },
  });

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
    if (isEditing) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();
    
    if (!selectedText) return;

    // Create a temporary span to wrap the selected text
    const span = document.createElement('span');
    span.className = 'bg-yellow-200';
    range.surroundContents(span);

    // Get the updated HTML content
    const updatedContent = contentRef.current?.innerHTML || '';
    
    try {
      await onUpdate(id, title, updatedContent);
      // Update editor content to reflect the new highlight
      editor?.commands.setContent(processContent(updatedContent));
      toast({
        title: "Success",
        description: "Text highlighted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to highlight text",
        variant: "destructive",
      });
    }

    // Clear the selection
    selection.removeAllRanges();
  };

  // Function to process content and ensure highlights are preserved
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
        await new Promise(resolve => setTimeout(resolve, speed));
      } else {
        // For whitespace and HTML tags, add a small delay
        setCurrentTypingContent(prev => prev + word);
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

  const handleSaveAIResponse = async () => {
    try {
      if (isEditing) {
        // If in edit mode, insert the AI response at the cursor position
        editor?.chain().focus().insertContent(pendingAIResponse).run();
      } else {
        // If in view mode, append the AI response to the existing content
        const currentContent = contentRef.current?.innerHTML || '';
        const newContent = currentContent + pendingAIResponse;
        await onUpdate(id, title, newContent);
        // Update the editor content if it exists
        editor?.commands.setContent(processContent(newContent));
      }
      setPendingAIResponse("");
      setCurrentTypingContent("");
      setShowPreview(false);
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
  };

  return (
    <Card>
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
      <CardContent className="space-y-4">
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
            <div className="prose prose-sm max-w-none">
              <EditorContent editor={editor} />
            </div>
          </div>
        ) : (
          <>
            <div 
              ref={contentRef}
              className="prose prose-sm max-w-none cursor-pointer"
              onClick={handleWordClick}
              dangerouslySetInnerHTML={{ __html: processContent(content || '') }}
            />
            {showPreview && (
              <div className="space-y-2">
                <div 
                  className="prose prose-sm max-w-none p-4 bg-muted/50 rounded-lg"
                  dangerouslySetInnerHTML={{ __html: currentTypingContent }}
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDiscardAIResponse}
                  >
                    Discard
                  </Button>
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
        <div className="mt-4 border-t pt-4">
          <AIChatInput onResponse={handleAIResponse} disabled={isTyping} />
        </div>
      </CardContent>
    </Card>
  );
} 