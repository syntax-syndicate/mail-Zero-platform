import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import OpenAI from 'openai';
import { formatThreadContext } from '@/lib/ai';

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
	const session = await auth.api.getSession({ headers: request.headers });

	if (!session?.user) throw new Error("Unauthorized");

	try {
		const body = await request.json();
		const { 
			prompt, 
			conversationHistory = [], 
			emailContent, 
			recipients,
			threadInfo = null,
			threadContext = null
		} = body;

		if (!prompt) {
			return NextResponse.json(
				{ error: 'Prompt is required' },
				{ status: 400 }
			);
		}

		const systemMessage = {
			role: 'system',
			content: `You are Zero, an email ai assistant for ${session.user.name} that helps ${session.user.name} draft emails. your main goal is to suggest reponses to the ${session.user.name}'s email. Here are a few parameters to work within:
                - You are always working in the context of ${session.user.name}'s email
                - DO NOT include a Subject line in your response
                - Only provide the body content of the email
                - ALWAYS start with a greeting like "Hi [Name]," or "Hello [Name]," on its own separate line
                - The greeting MUST be completely separated from the main content by a blank line
                - Format the greeting EXACTLY like this (with the newlines):

Hello [Name],

[Main content starts here...]

                - The greeting and first paragraph must NEVER be on the same line
                - Use newlines (\n) between paragraphs for proper spacing
                - Keep paragraphs short and focused for better readability
                - Use proper spacing throughout the email for a professional appearance
                - Keep paragraphs concise and focused
                - Always end the email with a signature closing on its own line, with a blank line before it, like this exact format:

Thanks,
${session.user.name}

                   OR

Best regards,
${session.user.name}

                   OR

Best,
${session.user.name}

                - There MUST be a blank line between each paragraph.
                - The name MUST be on its own line after the closing
                - Take into account the ${session.user.name}'s email content
                - Be creative with your emails response suggestions.
                `
		};

		const messages = [
			systemMessage,
			...conversationHistory,
		];

		// Use threadContext if provided (from thread-display component), otherwise fall back to threadInfo
		if (threadContext) {
			messages.push({
				role: 'system',
				content: `Thread Context: ${threadContext}`
			});
		} else if (threadInfo) {
			const { subject, messages: threadMessages } = threadInfo;
			
			let threadSummary = `This is part of an email thread with subject: "${subject}"`;
			
			if (threadMessages && threadMessages.length > 0) {
				threadSummary += "Previous messages in this thread:\n";
				
				// Include more context by using up to 5 recent messages instead of 3
				const recentMessages = threadMessages.slice(-5);
				
				recentMessages.forEach((msg, index) => {
					const sender = msg.sender?.name || msg.sender?.email || 'Unknown';
					const date = new Date(msg.receivedOn || '').toLocaleDateString();
					const content = msg.decodedBody || msg.body || '';
					
					const simplifiedContent = content
						.replace(/<[^>]*>/g, '') 
						.replace(/\s+/g, ' ')    
						.trim()
						.substring(0, 500);     
					
					threadSummary += `[Message ${index + 1}] From: ${sender} (${date}):\n${simplifiedContent}${simplifiedContent.length >= 500 ? '...' : ''}`;
				});
			}
			
			messages.push({
				role: 'system',
				content: `Thread Context: ${threadSummary}`
			});
		}

		if (emailContent) {
			messages.push({
				role: 'system',
				content: `The user's current email draft is:\n\n${emailContent}`,
			});
		}

		if (recipients && recipients.length > 0) {
			messages.push({
				role: 'system',
				content: `The email is addressed to: ${recipients.join(', ')}`,
			});
		}

		messages.push({
			role: 'user',
			content: prompt,
		});

		const completion = await openai.chat.completions.create({
			model: 'gpt-4o',
			messages: messages,
			temperature: 0.7,
			max_tokens: 1000,
			top_p: 1,
		});

		const generatedContent = completion.choices[0]?.message?.content || '';

		const response = {
			success: true,
			content: generatedContent,
			id: `suggestion-${Date.now()}`,
			type: 'email',
		};
		console.log('Sending response:', response);
		return NextResponse.json(response);
	} catch (error: any) {
		console.error('Error in ChatGPT API call:', error);

		return NextResponse.json(
			{
				error: 'Failed to generate suggestion',
				details: error.message || 'Unknown error',
			},
			{ status: 500 },
		);
	}
}
