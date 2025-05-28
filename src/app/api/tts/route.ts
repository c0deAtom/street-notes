import { NextResponse } from 'next/server';
import { writeFile, access } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Default voice ID

export async function POST(req: Request) {
  try {
    const { text, noteId } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json({ error: 'ElevenLabs API key not configured' }, { status: 500 });
    }

    // Generate a unique filename based on noteId and content hash
    const contentHash = crypto.createHash('md5').update(text).digest('hex');
    const filename = `${noteId}_${contentHash}.mp3`;
    const filePath = path.join(process.cwd(), 'public', 'audio', filename);

    // Check if file already exists
    try {
      await access(filePath);
      // If file exists, return the path
      return NextResponse.json({ 
        audioPath: `/audio/${filename}`,
        message: 'Using cached audio file'
      });
    } catch (error) {
      // File doesn't exist, continue with generation
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json({ error: error.detail || 'Failed to generate speech' }, { status: response.status });
    }

    const audioBuffer = await response.arrayBuffer();
    
    // Save the audio file
    await writeFile(filePath, Buffer.from(audioBuffer));

    return NextResponse.json({ 
      audioPath: `/audio/${filename}`,
      message: 'Audio file generated successfully'
    });
  } catch (error) {
    console.error('Text-to-speech error:', error);
    return NextResponse.json({ error: 'Failed to generate speech' }, { status: 500 });
  }
} 