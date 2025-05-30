import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Check for API key at startup
if (!process.env.OPENAI_API_KEY) {
  console.warn('Warning: OPENAI_API_KEY is not set in environment variables');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key', // Provide a dummy key to prevent initialization error
});

export async function POST(req: Request) {
  try {
    const { message, extractKeyTerms } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ 
        error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables.',
        code: 'MISSING_API_KEY'
      }, { status: 500 });
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

    // Regular chat completion with rich text formatting
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a helpful AI assistant that helps users create and improve their notes. Your responses must follow this exact structured format with emojis and HTML tags:

<div>
  <h1>📘 Topic: [Main Topic Title]</h1>

  <h2>1. 🔹 Overview</h2>
  <ul>
    <li>First key point</li>
    <li>Second key point</li>
  </ul>

  <h2>2. 📅 Key Dates / Timeline</h2>
  <ul>
    <li>Year – Event description</li>
    <li>Year – Event description</li>
  </ul>

  <h2>3. 🧑‍🤝‍🧑 Key People</h2>
  <ul>
    <li>Name – Role/Contribution</li>
    <li>Name – Role/Contribution</li>
  </ul>

  <h2>4. 🏛️ Key Concepts / Features</h2>
  <ul>
    <li>Concept – Brief explanation</li>
    <li>Feature – Brief explanation</li>
  </ul>

  <h2>5. 📌 Impact / Outcome</h2>
  <ul>
    <li>First impact point</li>
    <li>Second impact point</li>
  </ul>

  <h2>6. 📝 Fast Facts</h2>
  <ul>
    <li>Quick fact 1</li>
    <li>Quick fact 2</li>
  </ul>
</div>

Rules:
1. Always use this exact structure with the specified emojis
2. Keep bullet points concise and clear
3. Use proper HTML tags for formatting
4. Ensure all sections are present
5. Use appropriate emojis for each section
6. Keep the formatting clean and consistent
7. Use <strong> for important terms within bullet points
8. Use <mark> for highlighting key dates or numbers`
        },
        {
          role: "user",
          content: message
        }
      ],
      model: "gpt-3.5-turbo",
      temperature: 0.7,
    });

    const responseContent = completion.choices[0].message.content;
    if (!responseContent) {
      return NextResponse.json({ error: 'Failed to get AI response' }, { status: 500 });
    }

    // Ensure the response is wrapped in a div if it isn't already
    const formattedResponse = responseContent.trim().startsWith('<div>') 
      ? responseContent 
      : `<div>${responseContent}</div>`;

    return NextResponse.json({ response: formattedResponse });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Failed to get AI response' }, { status: 500 });
  }
} 