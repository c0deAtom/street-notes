import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { message, extractKeyTerms } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    if (extractKeyTerms) {
      // Extract key terms from the message
      const completion = await openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are a helpful AI that extracts key terms from text. Return ONLY a JSON array of important terms that should be highlighted, including names, dates, events, locations, and other significant information. Each term should be in lowercase. Example: ['john smith', 'january 15', 'conference', 'stanford university']"
          },
          {
            role: "user",
            content: message
          }
        ],
        model: "gpt-3.5-turbo",
        response_format: { type: "json_object" }
      });

      const responseContent = completion.choices[0].message.content;
      if (!responseContent) {
        return NextResponse.json({ error: 'Failed to get AI response' }, { status: 500 });
      }

      const keyTerms = JSON.parse(responseContent).terms || [];
      return NextResponse.json({ keyTerms });
    }

    // Regular chat completion with structured formatting
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a helpful AI assistant that helps users create and improve their notes. Format your responses in a clear, structured way using the following guidelines:

1. Use markdown formatting for better organization
2. Start with a brief summary or main point
3. Use bullet points or numbered lists for key information
4. Group related information under clear headings
5. Use bold for important terms or concepts
6. Add a "Key Points" section at the end
7. Keep the overall structure clean and easy to read

Example format:
## Summary
[Brief overview]

## Main Points
- Point 1
- Point 2
- Point 3

## Details
[Detailed information organized in sections]

## Key Points
- Important term 1
- Important term 2
- Important term 3`
        },
        {
          role: "user",
          content: message
        }
      ],
      model: "gpt-3.5-turbo",
    });

    return NextResponse.json({ 
      response: completion.choices[0].message.content 
    });
  } catch (error) {
    console.error('Chat completion error:', error);
    return NextResponse.json({ error: 'Failed to get AI response' }, { status: 500 });
  }
} 