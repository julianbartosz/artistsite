import { getAllPosts, getPostBySlug, getPostSlugs } from '@/lib/markdown';

// Mock the file system and MDX content
jest.mock('fs', () => ({
  readdirSync: jest.fn(),
  readFileSync: jest.fn(),
  existsSync: jest.fn(),
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  extname: jest.fn((path) => path.split('.').pop()),
}));

jest.mock('mdx-bundler', () => ({
  bundleMDX: jest.fn(),
}));

jest.mock('gray-matter', () => jest.fn());

const fs = require('fs');
const { bundleMDX } = require('mdx-bundler');
const matter = require('gray-matter');

describe('Markdown Library', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllPosts', () => {
    it('should return all posts with correct metadata', async () => {
      // Mock file system
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['post1.mdx', 'post2.mdx', 'draft.mdx']);
      fs.readFileSync.mockImplementation((path: string) => {
        if (path.includes('post1.mdx')) {
          return `---
title: Test Post 1
publishedAt: 2024-01-01
excerpt: Test excerpt 1
tags: [test, blog]
---
# Test Content 1`;
        }
        if (path.includes('post2.mdx')) {
          return `---
title: Test Post 2
publishedAt: 2024-01-02
excerpt: Test excerpt 2
tags: [test]
---
# Test Content 2`;
        }
        return `---
title: Draft Post
publishedAt: 2024-01-03
excerpt: Draft excerpt
isDraft: true
tags: [draft]
---
# Draft Content`;
      });

      matter.mockImplementation((content: string) => {
        if (content.includes('Test Post 1')) {
          return {
            data: {
              title: 'Test Post 1',
              publishedAt: '2024-01-01',
              excerpt: 'Test excerpt 1',
              tags: ['test', 'blog'],
            },
            content: '# Test Content 1',
          };
        }
        if (content.includes('Test Post 2')) {
          return {
            data: {
              title: 'Test Post 2',
              publishedAt: '2024-01-02',
              excerpt: 'Test excerpt 2',
              tags: ['test'],
            },
            content: '# Test Content 2',
          };
        }
        return {
          data: {
            title: 'Draft Post',
            publishedAt: '2024-01-03',
            excerpt: 'Draft excerpt',
            isDraft: true,
            tags: ['draft'],
          },
          content: '# Draft Content',
        };
      });

      const posts = await getAllPosts();

      expect(posts).toHaveLength(2); // Should exclude drafts
      expect(posts[0].title).toBe('Test Post 2'); // Should be sorted by date desc
      expect(posts[1].title).toBe('Test Post 1');
      expect(posts[0].slug).toBe('post2');
      expect(posts[1].slug).toBe('post1');
    });

    it('should handle empty directory', async () => {
      fs.existsSync.mockReturnValue(false);
      
      const posts = await getAllPosts();
      
      expect(posts).toHaveLength(0);
    });

    it('should include drafts when specified', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['draft.mdx']);
      fs.readFileSync.mockReturnValue(`---
title: Draft Post
publishedAt: 2024-01-03
excerpt: Draft excerpt
isDraft: true
tags: [draft]
---
# Draft Content`);

      matter.mockReturnValue({
        data: {
          title: 'Draft Post',
          publishedAt: '2024-01-03',
          excerpt: 'Draft excerpt',
          isDraft: true,
          tags: ['draft'],
        },
        content: '# Draft Content',
      });

      const posts = await getAllPosts(true);
      
      expect(posts).toHaveLength(1);
      expect(posts[0].isDraft).toBe(true);
    });
  });

  describe('getPostBySlug', () => {
    it('should return post with rendered content', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(`---
title: Test Post
publishedAt: 2024-01-01
excerpt: Test excerpt
tags: [test]
---
# Test Content

This is a test post.`);

      matter.mockReturnValue({
        data: {
          title: 'Test Post',
          publishedAt: '2024-01-01',
          excerpt: 'Test excerpt',
          tags: ['test'],
        },
        content: '# Test Content\n\nThis is a test post.',
      });

      bundleMDX.mockResolvedValue({
        code: 'const Component = () => <div>Rendered content</div>',
      });

      const post = await getPostBySlug('test-post');

      expect(post).toEqual({
        slug: 'test-post',
        title: 'Test Post',
        publishedAt: '2024-01-01',
        excerpt: 'Test excerpt',
        tags: ['test'],
        isDraft: false,
        coverImage: undefined,
        author: 'Artist',
        content: '# Test Content\n\nThis is a test post.',
        code: 'const Component = () => <div>Rendered content</div>',
      });
    });

    it('should return null for non-existent post', async () => {
      fs.existsSync.mockReturnValue(false);
      
      const post = await getPostBySlug('non-existent');
      
      expect(post).toBeNull();
    });

    it('should return null for drafts unless includeDrafts is true', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(`---
title: Draft Post
isDraft: true
---
# Draft Content`);

      matter.mockReturnValue({
        data: {
          title: 'Draft Post',
          isDraft: true,
        },
        content: '# Draft Content',
      });

      const post = await getPostBySlug('draft-post');
      expect(post).toBeNull();

      const draftPost = await getPostBySlug('draft-post', true);
      expect(draftPost).not.toBeNull();
    });
  });

  describe('getPostSlugs', () => {
    it('should return all post slugs', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['post1.mdx', 'post2.mdx', 'not-mdx.txt']);

      const slugs = await getPostSlugs();

      expect(slugs).toEqual(['post1', 'post2']);
    });

    it('should return empty array when directory does not exist', async () => {
      fs.existsSync.mockReturnValue(false);

      const slugs = await getPostSlugs();

      expect(slugs).toEqual([]);
    });
  });
});