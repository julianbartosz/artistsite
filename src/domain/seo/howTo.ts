// filepath: /Users/julianbartosz/git/repos/artistsite/src/domain/seo/howTo.ts
export interface HowToStep {
  name: string;
  text: string;
  image?: string;
  url?: string;
}
export function generateHowToSchema({
  name,
  description,
  image,
  totalTime,
  supply,
  tool,
  steps,
}: {
  name: string;
  description: string;
  image?: string;
  totalTime?: string;
  supply?: string[];
  tool?: string[];
  steps: HowToStep[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    description,
    image: image ? [image] : undefined,
    totalTime,
    supply: supply?.map(item => ({ '@type': 'HowToSupply', name: item })),
    tool: tool?.map(item => ({ '@type': 'HowToTool', name: item })),
    step: steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
      image: step.image,
      url: step.url,
    })),
  };
}
