import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface Highlight {
  word: string;
  index: number;
  id: string;
}

export async function POST(request: Request) {
  try {
    const { content, highlights } = await request.json();

    // Split content into words while preserving markdown
    const words = content.split(/(\s+)/);
    const wordPositions = new Map<string, number[]>();
    
    // Track positions of each word, skipping whitespace
    words.forEach((word: string, index: number) => {
      if (word.trim() === '') return;
      const normalizedWord = word.toLowerCase();
      if (!wordPositions.has(normalizedWord)) {
        wordPositions.set(normalizedWord, []);
      }
      wordPositions.get(normalizedWord)?.push(index);
    });

    // Update highlights based on new content
    const updatedHighlights: Highlight[] = [];
    
    for (const highlight of highlights) {
      const positions = wordPositions.get(highlight.word) || [];
      
      // If the word still exists in the content
      if (positions.length > 0) {
        // Find the closest position to the original index
        const closestPosition = positions.reduce((closest, current) => {
          return Math.abs(current - highlight.index) < Math.abs(closest - highlight.index) 
            ? current 
            : closest;
        }, positions[0]);

        // Add the highlight with the new position
        updatedHighlights.push({
          ...highlight,
          index: closestPosition
        });

        // Remove the used position
        const positionIndex = positions.indexOf(closestPosition);
        if (positionIndex > -1) {
          positions.splice(positionIndex, 1);
        }
      }
    }

    return NextResponse.json({ highlights: updatedHighlights });
  } catch (error) {
    console.error('Error processing highlights:', error);
    return NextResponse.json(
      { error: 'Failed to process highlights' },
      { status: 500 }
    );
  }
} 