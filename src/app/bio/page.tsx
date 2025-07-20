import Image from 'next/image';
import Link from 'next/link';

export default function BioPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
                About the Artist
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Contemporary painter exploring the intersection of urban landscapes, 
                abstract form, and the ever-changing quality of light through oil 
                and mixed media works.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link 
                  href="/portfolio" 
                  className="bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors text-center font-medium"
                >
                  View Portfolio
                </Link>
                <Link 
                  href="/contact" 
                  className="border border-gray-900 text-gray-900 px-6 py-3 rounded-lg hover:bg-gray-900 hover:text-white transition-colors text-center font-medium"
                >
                  Get in Touch
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="relative w-full aspect-[4/5] rounded-lg overflow-hidden shadow-xl">
                <Image
                  src="/images/artist-portrait.jpg"
                  alt="Artist in studio"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Artist Statement */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Artist Statement</h2>
          <div className="prose prose-lg mx-auto text-gray-700">
            <p className="text-xl leading-relaxed mb-6">
              My work explores the dynamic relationship between urban environments and natural light, 
              capturing fleeting moments where architecture becomes canvas and shadow becomes form. 
              Through oil painting and mixed media, I seek to translate the emotional resonance of 
              city life into abstract compositions that speak to our shared human experience.
            </p>
            <p className="leading-relaxed mb-6">
              Each piece begins with observation—the way morning light filters through building facades, 
              how evening shadows create unexpected geometries, or the rhythm of movement in bustling 
              street scenes. These moments of urban poetry become the foundation for works that balance 
              representation with abstraction, allowing viewers to discover their own connections to 
              the metropolitan landscape.
            </p>
            <p className="leading-relaxed">
              Working primarily in oil on canvas, I employ both traditional techniques and contemporary 
              approaches, often incorporating elements of collage and mixed media to create textural 
              depth that mirrors the complexity of urban experience. My palette draws from the subtle 
              variations of city light—warm ochres of sunset on concrete, cool blues of predawn streets, 
              and the infinite grays that define metropolitan atmosphere.
            </p>
          </div>
        </div>
      </section>

      {/* Background & Education */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-8">Background</h2>
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Education</h3>
                  <div className="space-y-2 text-gray-700">
                    <p><strong>MFA, Painting</strong> - Yale School of Art, 2018</p>
                    <p><strong>BFA, Fine Arts</strong> - Rhode Island School of Design, 2015</p>
                    <p><strong>Study Abroad</strong> - Florence Academy of Art, 2014</p>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Professional Experience</h3>
                  <div className="space-y-2 text-gray-700">
                    <p><strong>Studio Artist</strong> - Independent Practice, 2018-Present</p>
                    <p><strong>Teaching Assistant</strong> - Yale School of Art, 2016-2018</p>
                    <p><strong>Gallery Intern</strong> - David Zwirner Gallery, 2015</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-8">Achievements</h2>
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Selected Exhibitions</h3>
                  <div className="space-y-2 text-gray-700">
                    <p><strong>2024</strong> - "Urban Abstractions" - Solo Exhibition, Gallery Modern</p>
                    <p><strong>2023</strong> - "New Voices in Contemporary Art" - Group Show, MoMA PS1</p>
                    <p><strong>2022</strong> - "Light and Shadow" - Solo Exhibition, Tribeca Gallery</p>
                    <p><strong>2021</strong> - "Emerging Artists" - Group Show, Whitney Biennial</p>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Awards & Recognition</h3>
                  <div className="space-y-2 text-gray-700">
                    <p><strong>2023</strong> - Artist Fellowship, New York Foundation for the Arts</p>
                    <p><strong>2022</strong> - Emerging Artist Award, Art Basel Miami</p>
                    <p><strong>2019</strong> - Yale School of Art Merit Scholarship</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Studio Practice */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Studio Practice</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden shadow-lg">
              <Image
                src="/images/artist-studio.jpg"
                alt="Artist studio workspace"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
            <div>
              <div className="prose prose-lg text-gray-700">
                <p className="text-lg leading-relaxed mb-6">
                  My studio practice is rooted in direct observation and material experimentation. 
                  Located in a converted warehouse in Long Island City, the space allows for both 
                  intimate drawing sessions and large-scale painting projects.
                </p>
                <p className="leading-relaxed mb-6">
                  I typically work on multiple pieces simultaneously, allowing ideas to cross-pollinate 
                  and evolve organically. The studio serves as both laboratory and sanctuary, where 
                  urban inspiration is transformed into artistic expression through careful attention 
                  to color, form, and texture.
                </p>
                <p className="leading-relaxed">
                  My materials range from traditional oil paints and brushes to unconventional tools 
                  like palette knives, found objects, and various texturing mediums. This hybrid 
                  approach reflects my interest in bridging classical techniques with contemporary 
                  conceptual frameworks.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Collections & Press */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">Collections & Press</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Public Collections</h3>
              <div className="space-y-2 text-gray-700">
                <p>Museum of Contemporary Art, Chicago</p>
                <p>Brooklyn Museum Permanent Collection</p>
                <p>Yale University Art Gallery</p>
                <p>Private collections throughout the US and Europe</p>
              </div>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Press & Publications</h3>
              <div className="space-y-2 text-gray-700">
                <p><em>Artforum</em> - "Rising Stars of 2024"</p>
                <p><em>ARTnews</em> - "Urban Abstractions Review"</p>
                <p><em>Art in America</em> - "New York Studio Visits"</p>
                <p><em>Hyperallergic</em> - "Contemporary Landscape Painting"</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Connect With My Work</h2>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Interested in learning more about my artistic practice, available works, 
            or commission opportunities? I'd love to hear from you.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/portfolio" 
              className="bg-gray-900 text-white px-8 py-3 rounded-lg hover:bg-gray-800 transition-colors font-medium"
            >
              Explore Portfolio
            </Link>
            <Link 
              href="/shop" 
              className="border border-gray-900 text-gray-900 px-8 py-3 rounded-lg hover:bg-gray-900 hover:text-white transition-colors font-medium"
            >
              Available Works
            </Link>
            <Link 
              href="/contact" 
              className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg hover:border-gray-900 hover:text-gray-900 transition-colors font-medium"
            >
              Contact
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}