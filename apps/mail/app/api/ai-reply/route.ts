import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const headersList = await headers();

  const session = await auth.api.getSession({ headers: headersList });
  if (!session?.user) throw new Error('Unauthorized');

  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key is not configured' }, { status: 500 });
    }

    const { threadContent, originalSender, userName, userEmail } = await req.json();

    if (!threadContent) {
      return NextResponse.json({ error: 'Thread content is required' }, { status: 400 });
    }

    // Create the prompt for OpenAI
    const prompt = `
    You are ${session.user.name}, writing an email reply.
    
    Here's the context of the email thread:
    ${threadContent}
    
    Generate a professional, helpful, and concise email reply to ${originalSender}.
    
    Requirements:
    - Be concise but thorough (2-3 paragraphs maximum)
    - Maintain a professional and friendly tone
    - Address the key points from the original email
    - Close with an appropriate sign-off
    - Don't use placeholder text or mention that you're an AI
    - Write as if you are (${session.user.name})
    - Don't include the subject line in the reply
    - Double space paragraphs (2 newlines)
    - Add two spaces bellow the sign-off
    `;

    try {
      // Direct OpenAI API call using fetch
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful email assistant that generates concise, professional replies.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      if (!openaiResponse.ok) {
        const errorData = await openaiResponse.json();
        throw new Error(`OpenAI API Error: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await openaiResponse.json();
      const reply = data.choices[0]?.message?.content || '';
      
      return NextResponse.json({ reply });
    } catch (openaiError: any) {
      console.error('OpenAI API Error:', openaiError);
      return NextResponse.json(
        { error: `OpenAI API Error: ${openaiError.message || 'Unknown error'}` },
        { status: 500 },
      );
    }
  } catch (error: any) {
    console.error('AI Reply Error:', error);
    return NextResponse.json(
      { error: `Failed to generate AI reply: ${error.message || 'Unknown error'}` },
      { status: 500 },
    );
  }
}
