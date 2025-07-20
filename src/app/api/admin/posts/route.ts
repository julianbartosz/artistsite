import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { writeFile } from 'fs/promises';
import { join } from 'path';

// Mock blog posts data - replace with actual database
const mockPosts = [
  {
    id: '1',
    title: 'My Latest Abstract Series',
    slug: 'latest-abstract-series',
    excerpt: 'Exploring color and form in my newest collection of abstract paintings.',
    content: '<p>This is the content of my latest blog post...</p>',
    status: 'published',
    publishedAt: '2024-01-15T10:00:00Z',
    views: 1245,
    featured: true,
    category: 'art-process',
    tags: ['abstract', 'painting', 'color'],
  },
  {
    id: '2',
    title: 'Studio Tour and Process',
    slug: 'studio-tour-process',
    excerpt: 'Take a behind-the-scenes look at my creative process.',
    content: '<p>Welcome to my studio...</p>',
    status: 'draft',
    publishedAt: null,
    views: 0,
    featured: false,
    category: 'personal',
    tags: ['studio', 'process'],
  },
];

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(mockPosts, {
      headers: {
        'Cache-Control': 'private, max-age=60', // 1 minute cache
      },
    });
  } catch (error) {
    console.error('Posts API error:', error);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    
    // Validate required fields
    if (!data.title || !data.content || !data.slug) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create new post object
    const newPost = {
      id: Date.now().toString(),
      ...data,
      publishedAt: data.status === 'published' ? new Date().toISOString() : null,
      views: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // In a real implementation, save to database
    // For now, we'll save to a JSON file as a demo
    try {
      const filePath = join(process.cwd(), 'src/content/blog', `${data.slug}.json`);
      await writeFile(filePath, JSON.stringify(newPost, null, 2));
    } catch (fileError) {
      console.warn('Could not save to file system:', fileError);
    }

    return NextResponse.json({ 
      success: true, 
      post: newPost 
    }, { status: 201 });

  } catch (error) {
    console.error('Create post error:', error);
    return NextResponse.json(
      { error: 'Failed to create post' },
      { status: 500 }
    );
  }
}