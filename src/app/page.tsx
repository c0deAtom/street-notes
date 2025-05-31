"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthForm } from "@/components/AuthForm";
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/notes");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="container mx-auto p-4 h-[calc(100vh-4rem)]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center h-full pb-50">
          {/* Left side - Welcome message */}
          <div className="flex flex-col items-center md:items-start justify-center space-y-6 text-center md:text-left">
            <h1 className="text-4xl font-bold">Welcome to ReNotes</h1>
            <p className="text-xl text-muted-foreground">
              Your personal note-taking and highlighting app with AI-powered features
            </p>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 rounded-full bg-primary"></div>
                <p>Smart text highlighting</p>
              </div>
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 rounded-full bg-primary"></div>
                <p>AI-powered note generation</p>
              </div>
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 rounded-full bg-primary"></div>
                <p>Interactive quiz mode</p>
              </div>
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 rounded-full bg-primary"></div>
                <p>Text-to-speech functionality</p>
              </div>
            </div>
          </div>

          {/* Right side - Auth form */}
          <div className="flex items-center justify-center">
            <AuthForm />
          </div>
        </div>
      </div>
    );
  }

  return null;
}
