'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-center">
        <h1 className="text-4xl font-bold mb-6">Welcome to ReNotes</h1>
        <p className="text-xl mb-8">Your personal note-taking and highlighting app</p>
        <Link href="/notes">
          <Button size="lg">View My Notes</Button>
        </Link>
      </div>
    </div>
  );
}
