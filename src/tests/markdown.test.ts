import { getAllPosts, getPostBySlug, getPostSlugs } from '@/lib/markdown';
import fs from 'fs';
import { bundleMDX } from 'mdx-bundler';
import matter from 'gray-matter';

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

// Cast the mocked modules for TypeScript
const mockFs = fs as jest.Mocked<typeof fs>;
const mockBundleMDX = bundleMDX as jest.MockedFunction<typeof bundleMDX>;
const mockMatter = matter as jest.MockedFunction<typeof matter>;

describe('Markdown Library', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllPosts', () => {
    it('should return all posts with correct metadata', async () => {
      // Mock file system
      mockFs.existsSync.mockReturnValue(true);
      (mockFs.readdirSync as jest.Mock).mockReturnValue(['post1.mdx', 'post2.mdx', 'draft.mdx']);
      (mockFs.readFileSync as jest.Mock).mockImplementation((path: any) => {
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

      mockMatter.mockImplementation((content: any) => {
        if (content.includes('Test Post 1')) {
          return {
            data: {
              title: 'Test Post 1',
              publishedAt: '2024-01-01',
              excerpt: 'Test excerpt 1',
              tags: ['test', 'blog'],
            },
            content: '# Test Content 1',
            orig: content,
            language: '',
            matter: '',
            stringify: jest.fn(),
          } as any;
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
            orig: content,
            language: '',
            matter: '',
            stringify: jest.fn(),
          } as any;
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
          orig: content,
          language: '',
          matter: '',
          stringify: jest.fn(),
        } as any;
      });

      const posts = await getAllPosts();
      expect(posts).toHaveLength(2); // Should exclude drafts
      expect(posts[0].title).toBe('Test Post 2'); // Should be sorted by date desc
      expect(posts[1].title).toBe('Test Post 1');
      expect(posts[0].slug).toBe('post2');
      expect(posts[1].slug).toBe('post1');
    });

    it('should handle empty directory', async () => {
      mockFs.existsSync.mockReturnValue(false);
      
      const posts = await getAllPosts();
      
      expect(posts).toHaveLength(0);
    });

    it('should include drafts when specified', async () => {
      mockFs.existsSync.mockReturnValue(true);
      (mockFs.readdirSync as jest.Mock).mockReturnValue(['draft.mdx']);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(`---
title: Draft Post
publishedAt: 2024-01-03
excerpt: Draft excerpt
isDraft: true
tags: [draft]
---
# Draft Content`);

      mockMatter.mockReturnValue({
        data: {
          title: 'Draft Post',
          publishedAt: '2024-01-03',
          excerpt: 'Draft excerpt',
          isDraft: true,
          tags: ['draft'],
        },
        content: '# Draft Content',
        orig: '',
        language: '',
        matter: '',
        stringify: jest.fn(),
      } as any);

      const posts = await getAllPosts(true);
      
      expect(posts).toHaveLength(1);
      expect(posts[0].isDraft).toBe(true);
    });
  });

  describe('getPostBySlug', () => {
    it('should return post with rendered content', async () => {
      mockFs.existsSync.mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(`---
title: Test Post
publishedAt: 2024-01-01
excerpt: Test excerpt
tags: [test]
---
# Test Content

This is a test post.`);

      mockMatter.mockReturnValue({
        data: {
          title: 'Test Post',
          publishedAt: '2024-01-01',
          excerpt: 'Test excerpt',
          tags: ['test'],
        },
        content: '# Test Content\n\nThis is a test post.',
        orig: '',
        language: '',
        matter: '',
        stringify: jest.fn(),
      } as any);

      (mockBundleMDX as jest.Mock).mockResolvedValue({
        code: 'const Component = () => <div>Rendered content</div>',
        frontmatter: {},
        errors: [],
        matter: {
          data: {},
          content: '',
          orig: '',
          language: '',
          stringify: jest.fn(),
        },
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
      mockFs.existsSync.mockReturnValue(false);
      
      const post = await getPostBySlug('non-existent');
      
      expect(post).toBeNull();
    });

    it('should return null for drafts unless includeDrafts is true', async () => {
      mockFs.existsSync.mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(`---
title: Draft Post
isDraft: true
---
# Draft Content`);

      mockMatter.mockReturnValue({
        data: {
          title: 'Draft Post',
          isDraft: true,
        },
        content: '# Draft Content',
        orig: '',
        language: '',
        matter: '',
        stringify: jest.fn(),
      } as any);

      const post = await getPostBySlug('draft-post');
      expect(post).toBeNull();

      const draftPost = await getPostBySlug('draft-post', true);
      expect(draftPost).not.toBeNull();
    });
  });

  describe('getPostSlugs', () => {
    it('should return all post slugs', async () => {
      mockFs.existsSync.mockReturnValue(true);
      (mockFs.readdirSync as jest.Mock).mockReturnValue(['post1.mdx', 'post2.mdx', 'not-mdx.txt']);

      const slugs = await getPostSlugs();

      expect(slugs).toEqual(['post1', 'post2']);
    });

    it('should return empty array when directory does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const slugs = await getPostSlugs();

      expect(slugs).toEqual([]);
    });
  });
});