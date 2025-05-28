'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Home, BookOpen } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="font-bold text-xl">
            ReNotes
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/">
              <Button
                variant={pathname === '/' ? 'default' : 'ghost'}
                size="sm"
                className="gap-2"
              >
                <Home className="h-4 w-4" />
                Home
              </Button>
            </Link>
            <Link href="/notes">
              <Button
                variant={pathname === '/notes' ? 'default' : 'ghost'}
                size="sm"
                className="gap-2"
              >
                <BookOpen className="h-4 w-4" />
                Notes
              </Button>
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
} 