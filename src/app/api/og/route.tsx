import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title') || 'Artist Site';
    const description = searchParams.get('description') || 'Contemporary Art & Portfolio';
    const type = searchParams.get('type') || 'website';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#ffffff',
            backgroundImage: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '20px',
              padding: '60px',
              margin: '40px',
              maxWidth: '1000px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h1
              style={{
                fontSize: type === 'article' ? '60px' : '72px',
                fontWeight: 'bold',
                color: '#1a1a1a',
                textAlign: 'center',
                marginBottom: '20px',
                lineHeight: '1.1',
              }}
            >
              {title}
            </h1>
            {description && (
              <p
                style={{
                  fontSize: '32px',
                  color: '#666666',
                  textAlign: 'center',
                  marginBottom: '0',
                  lineHeight: '1.3',
                }}
              >
                {description}
              </p>
            )}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginTop: '40px',
              }}
            >
              <div
                style={{
                  width: '60px',
                  height: '60px',
                  backgroundColor: '#667eea',
                  borderRadius: '50%',
                  marginRight: '20px',
                }}
              />
              <span
                style={{
                  fontSize: '28px',
                  color: '#333333',
                  fontWeight: '600',
                }}
              >
                Artist Site
              </span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    console.error('Error generating OG image:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}