import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const tiles = await prisma.tile.findMany({
    orderBy: {
      position: 'asc'
    }
  });
  return NextResponse.json(tiles);
}

export async function POST(request: Request) {
  const { title, content, position, noteId } = await request.json();
  const tile = await prisma.tile.create({
    data: { 
      title, 
      content, 
      position,
      noteId 
    }
  });
  return NextResponse.json(tile);
}

export async function DELETE(request: Request) {
  const { id } = await request.json();
  await prisma.tile.delete({
    where: { id },
  });
  return NextResponse.json({ success: true });
}

export async function PATCH(request: Request) {
  const { id, title, content, position } = await request.json();
  const tile = await prisma.tile.update({
    where: { id },
    data: { title, content, position },
  });
  return NextResponse.json(tile);
} 