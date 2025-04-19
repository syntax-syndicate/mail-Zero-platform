import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export async function POST(request: Request) {
  try {
    const { emails } = await request.json();
    
    if (!emails || !Array.isArray(emails)) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Write the updated list to output.json in the public directory
    const outputPath = join(process.cwd(), 'public', 'output.json');
    await writeFile(outputPath, JSON.stringify({ emails }, null, 2));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating emailed users:', error);
    return NextResponse.json(
      { error: 'Failed to update emailed users list' },
      { status: 500 }
    );
  }
} 