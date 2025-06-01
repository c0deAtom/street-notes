"use client";

import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, User, Settings, Search, Bell, Sun, Moon } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import ReactDOM from "react-dom";
import type { Note, Tile } from '@/types';

interface NavbarProps {
  notes: Note[];
  openTabs: Note[];
  setActiveTab: Dispatch<SetStateAction<string | undefined>>;
  setSelectedNote: Dispatch<SetStateAction<Note | null>>;
  setOpenTabs?: Dispatch<SetStateAction<Note[]>>;
  onSidebarOpen?: () => void;
}

// Helper to get a snippet of 5-6 words around the search term
function getSnippet(content: string, search: string, wordsAround = 3) {
  if (!content || !search) return '';
  const text = content.replace(/<[^>]+>/g, ' '); // strip HTML
  const lower = text.toLowerCase();
  const idx = lower.indexOf(search.toLowerCase());
  if (idx === -1) return text.split(/\s+/).slice(0, 6).join(' ');
  // Find the word index
  const words = text.split(/\s+/);
  let charCount = 0;
  let matchWordIdx = 0;
  for (let i = 0; i < words.length; i++) {
    charCount += words[i].length + 1;
    if (charCount > idx) {
      matchWordIdx = i;
      break;
    }
  }
  const start = Math.max(0, matchWordIdx - wordsAround);
  const end = Math.min(words.length, matchWordIdx + wordsAround + 1);
  let snippet = words.slice(start, end).join(' ');
  // Highlight the search term
  const re = new RegExp(`(${search})`, 'ig');
  snippet = snippet.replace(re, '<mark class="bg-yellow-200">$1</mark>');
  return snippet;
}

export function Navbar({ notes, openTabs, setActiveTab, setSelectedNote, setOpenTabs, onSidebarOpen }: NavbarProps) {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(3); // Example notification count

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<{
    noteId: string;
    noteTitle: string;
    tileId: string;
    tileTitle: string;
    tileContent: string | null;
  }[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLDivElement | null>(null);
  const inputBoxRef = useRef<HTMLInputElement | null>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!searchTerm) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    const results: {
      noteId: string;
      noteTitle: string;
      tileId: string;
      tileTitle: string;
      tileContent: string | null;
    }[] = [];
    for (const note of notes) {
      for (const tile of note.tiles) {
        if (
          (tile.content && tile.content.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (tile.title && tile.title.toLowerCase().includes(searchTerm.toLowerCase()))
        ) {
          results.push({
            noteId: note.id,
            noteTitle: note.title,
            tileId: tile.id,
            tileTitle: tile.title,
            tileContent: tile.content,
          });
        }
      }
    }
    setSearchResults(results);
    setShowDropdown(results.length > 0);
  }, [searchTerm, notes]);

  // Position dropdown absolutely over all content
  useEffect(() => {
    if (showDropdown && inputBoxRef.current) {
      const rect = inputBoxRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        left: rect.left,
        top: rect.bottom + 4,
        width: rect.width,
        zIndex: 9999,
        maxWidth: 480,
        minWidth: 300,
      });
    }
  }, [showDropdown]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (inputRef.current && e.target instanceof Node && !inputRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showDropdown]);

  const handleSignOut = async () => {
    try {
      await signOut({ callbackUrl: "/login" });
      toast({
        title: "Success",
        description: "Logged out successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to log out",
        variant: "destructive",
      });
    }
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    // Add theme toggle logic here
    toast({
      title: "Theme Changed",
      description: `Switched to ${isDarkMode ? 'light' : 'dark'} mode`,
    });
  };

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center  container mx-2">
        {/* Mobile sidebar toggle button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden mr-2"
          onClick={onSidebarOpen}
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-menu h-6 w-6"><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="18" x2="20" y2="18" /></svg>
        </Button>
        <div className="flex items-center gap-4 flex-1">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            ReNotes
          </h1>
          <div className="relative w-full max-w-sm" ref={inputRef}>
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search notes..."
              className="pl-8 bg-muted/50"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onFocus={() => setShowDropdown(searchResults.length > 0)}
              ref={inputBoxRef}
            />
            {showDropdown && typeof window !== 'undefined' && ReactDOM.createPortal(
              <>
                <div className="fixed inset-0 z-[9998] bg-black/10" onClick={() => setShowDropdown(false)} />
                <div
                  className="bg-background border border-border rounded-lg shadow-xl z-[9999] max-h-80 overflow-y-auto max-w-xl w-full min-w-[300px] p-1"
                  style={dropdownStyle}
                >
                  {searchResults.length === 0 ? (
                    <div className="p-3 text-center text-muted-foreground text-sm">No matching tiles found.</div>
                  ) : (
                    searchResults.map(result => (
                      <div
                        key={result.tileId}
                        className="p-2 hover:bg-muted cursor-pointer border-b last:border-b-0 rounded transition-colors"
                        onClick={() => {
                          const note = notes.find(n => n.id === result.noteId) || null;
                          if (note) {
                            // If not already open, add to openTabs
                            if (setOpenTabs && !openTabs.find(tab => tab.id === note.id)) {
                              setOpenTabs(prev => [...prev, note]);
                            }
                            setActiveTab(note.id);
                            setSelectedNote(note);
                          }
                          setSearchTerm("");
                          setShowDropdown(false);
                        }}
                      >
                        <div className="font-semibold text-sm truncate">{result.tileTitle}</div>
                        {result.tileContent && searchTerm && (
                          <div className="text-xs truncate text-muted-foreground" dangerouslySetInnerHTML={{ __html: getSnippet(result.tileContent, searchTerm, 3) }} />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>,
              document.body
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => {
              setNotifications(0);
              toast({
                title: "Notifications",
                description: "All notifications cleared",
              });
            }}
          >
            <Bell className="h-5 w-5" />
            {notifications > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0"
              >
                {notifications}
              </Badge>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
          >
            {isDarkMode ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
          {session?.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8 ring-2 ring-primary/20">
                    <AvatarImage src={session.user.image || ""} alt={session.user.name || ""} />
                    <AvatarFallback className="bg-primary/10">
                      {session.user.name?.charAt(0) || session.user.email?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{session.user.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {session.user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="default" asChild>
              <a href="/login">Sign in</a>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
} 