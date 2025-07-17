import Image from "next/image";
import Link from "next/link";
import { getAllPosts } from "@/lib/markdown";
import { getFeaturedArtworks } from "@/lib/portfolio";
import { NewsletterSignup } from "@/components/NewsletterSignup";

export default async function Home() {
  const [recentPosts, featuredArtworks] = await Promise.all([
    getAllPosts().then(posts => posts.slice(0, 3)),
    getFeaturedArtworks(3)
  ]);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative z-10 text-center max-w-4xl mx-auto px-6">
          <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6">
            Capturing Light<br />
            <span className="text-gray-600">Through Art</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-700 mb-8 max-w-2xl mx-auto">
            Contemporary paintings and drawings exploring the intersection of 
            urban landscapes, abstract form, and the ever-changing quality of light.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/portfolio"
              className="bg-gray-900 text-white px-8 py-4 rounded-lg hover:bg-gray-800 transition-colors font-medium text-lg"
            >
              View Portfolio
            </Link>
            <Link
              href="/blog"
              className="border-2 border-gray-900 text-gray-900 px-8 py-4 rounded-lg hover:bg-gray-900 hover:text-white transition-colors font-medium text-lg"
            >
              Read Blog
            </Link>
          </div>
        </div>
        
        {/* Hero Image */}
        <div className="absolute bottom-8 right-8 w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-xl">
          <Image
            src="/images/artist-portrait.jpg"
            alt="Artist portrait"
            fill
            className="object-cover"
          />
        </div>
      </section>

      {/* Featured Artworks Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Featured Works</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              A selection of recent pieces that showcase my ongoing exploration 
              of light, form, and urban environments.
            </p>
          </div>

          {featuredArtworks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
              {featuredArtworks.map((artwork) => (
                <Link key={artwork.slug} href={`/portfolio/${artwork.slug}`} className="group">
                  <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100 mb-4">
                    <Image
                      src={artwork.images.thumbnail}
                      alt={artwork.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300"></div>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                    {artwork.title}
                  </h3>
                  <p className="text-gray-600 text-sm mb-2">{artwork.medium}</p>
                  <p className="text-gray-700">{artwork.description}</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">Featured artworks coming soon...</p>
            </div>
          )}

          <div className="text-center">
            <Link
              href="/portfolio"
              className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium text-lg"
            >
              View Full Portfolio →
            </Link>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">About the Artist</h2>
              <p className="text-lg text-gray-700 mb-6 leading-relaxed">
                My work explores the dynamic relationship between light and form in urban environments. 
                Through painting and drawing, I seek to capture the fleeting moments when ordinary 
                cityscapes are transformed by the changing quality of light throughout the day.
              </p>
              <p className="text-lg text-gray-700 mb-8 leading-relaxed">
                Working primarily with oils, acrylics, and mixed media, I layer colors and textures 
                to create pieces that hover between abstraction and representation, inviting viewers 
                to discover their own connections to the urban landscape.
              </p>
              <Link
                href="/contact"
                className="bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors font-medium"
              >
                Get in Touch
              </Link>
            </div>
            <div className="relative">
              <div className="aspect-square rounded-lg overflow-hidden bg-gray-200">
                <Image
                  src="/images/artist-studio.jpg"
                  alt="Artist studio"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Blog Posts */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Latest Insights</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Thoughts on art, creativity, and the artistic process. Follow along 
              as I document my journey and share insights from the studio.
            </p>
          </div>

          {recentPosts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
              {recentPosts.map((post) => (
                <Link key={post.slug} href={`/blog/${post.slug}`} className="group">
                  <article className="bg-gray-50 rounded-lg p-6 h-full hover:shadow-lg transition-shadow">
                    <div className="mb-4">
                      <time className="text-sm text-gray-500">
                        {new Date(post.publishedAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </time>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                      {post.title}
                    </h3>
                    <p className="text-gray-700 leading-relaxed">
                      {post.excerpt}
                    </p>
                  </article>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">Blog posts coming soon...</p>
            </div>
          )}

          <div className="text-center">
            <Link
              href="/blog"
              className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium text-lg"
            >
              Read All Posts →
            </Link>
          </div>
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="py-20 bg-gray-900 text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-4">Stay Connected</h2>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Get updates on new works, upcoming exhibitions, and insights from the studio. 
            Join a community of art enthusiasts and collectors.
          </p>
          <NewsletterSignup />
        </div>
      </section>
    </div>
  );
}
