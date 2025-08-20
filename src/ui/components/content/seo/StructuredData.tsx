import { Thing, WithContext } from 'schema-dts'

interface StructuredDataProps {
  data: WithContext<Thing>
}

export function StructuredData({ data }: StructuredDataProps) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
}
