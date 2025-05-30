import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const notes = await prisma.note.findMany({
    orderBy: {
      createdAt: 'desc'
    },
    include: {
      tiles: {
        orderBy: {
          position: 'asc'
        }
      }
    }
  });
  return NextResponse.json(notes);
}

export async function POST(request: Request) {
  const { title, content } = await request.json();
  const note = await prisma.note.create({
    data: { title, content },
    include: {
      tiles: true
    }
  });
  return NextResponse.json(note);
}

export async function DELETE(request: Request) {
  const { id } = await request.json();
  await prisma.note.delete({
    where: { id },
  });
  return NextResponse.json({ success: true });
}

export async function PATCH(request: Request) {
  const { id, highlights, content, title } = await request.json();
  const note = await prisma.note.update({
    where: { id },
    data: {  content, title },
    include: {
      tiles: {
        orderBy: {
          position: 'asc'
        }
      }
    }
  });
  return NextResponse.json(note);
} 