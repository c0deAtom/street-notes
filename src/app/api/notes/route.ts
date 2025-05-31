import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { User, Note, Tile } from '@prisma/client'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: {
        email: session.user.email
      },
      include: {
        notes: {
          orderBy: {
            position: 'asc'
          },
          include: {
            tiles: {
              orderBy: {
                position: 'asc'
              }
            }
          }
        }
      }
    });

    if (!user) {
      return new NextResponse("User not found", { status: 404 });
    }

    return NextResponse.json(user.notes);
  } catch (error) {
    console.error("[NOTES_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    const { title, content } = body;

    if (!title) {
      return new NextResponse("Title is required", { status: 400 });
    }

    // Get the user
    const user = await prisma.user.findUnique({
      where: {
        email: session.user.email
      }
    });

    if (!user) {
      return new NextResponse("User not found", { status: 404 });
    }

    // Get the highest position
    const lastNote = await prisma.note.findFirst({
      where: {
        userId: user.id
      },
      orderBy: {
        position: 'desc'
      }
    });

    const position = lastNote ? lastNote.position + 1 : 0;

    const note = await prisma.note.create({
      data: {
        title,
        content,
        position,
        userId: user.id
      }
    });

    return NextResponse.json(note);
  } catch (error) {
    console.error("[NOTES_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { id } = await request.json();
  
  // First delete all tiles associated with the note
  await prisma.tile.deleteMany({
    where: { noteId: id }
  });
  
  // Then delete the note
  await prisma.note.delete({
    where: { id }
  });
  
  return NextResponse.json({ success: true });
}

export async function PATCH(request: Request) {
  const { id, highlights, content, title } = await request.json();
  const note = await prisma.note.update({
    where: { id },
    data: { content, title },
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