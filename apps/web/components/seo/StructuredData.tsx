// Built by Anointed Coder.
//
// JSON-LD structured data for the public site.
//
// Two schemas, both aimed at how search engines resolve a BRAND query rather
// than a keyword query:
//
//   Organization - declares the brand entity, its logo, its contact point and
//     crucially its alternateName list. That list is what lets a search engine
//     treat "Pasa9" as the same entity as "Pasha 9" rather than as an
//     unrelated string. This is the single most useful thing we can do for the
//     client's stated goal of ranking for the misspelling he bought the domain
//     for; the 301 from pasa9.com passes the authority, the alternateName
//     tells the engine the two names denote one brand.
//
//   WebSite - declares the canonical site and its search action, which is what
//     produces a sitelinks search box for brand queries.
//
// Emitted server-side so crawlers see it in the initial HTML. Values come from
// admin settings where they exist, so the operator can change the brand name
// without a redeploy.

interface Props {
  siteName: string;
  siteUrl: string;
  description: string;
  logoUrl?: string | null;
  /** Telegram / support handles the operator has configured. */
  sameAs?: string[];
}

// Common ways players type the brand. Kept here rather than inline so the
// operator's own list stays one edit away.
//
// These are genuine alternate spellings of the same brand, which is what
// alternateName is for. It is not a place to list unrelated terms - search
// engines discount obviously unrelated values and it risks the whole block
// being ignored.
const ALTERNATE_NAMES = [
  'Pasa9',
  'Pasa 9',
  'Pasha9',
  'Pasha 9',
  'পাশা ৯',
];

export function StructuredData({ siteName, siteUrl, description, logoUrl, sameAs }: Props) {
  const base = siteUrl.replace(/\/+$/, '');

  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${base}/#organization`,
    name: siteName,
    alternateName: ALTERNATE_NAMES,
    url: base,
    ...(logoUrl ? { logo: { '@type': 'ImageObject', url: logoUrl.startsWith('http') ? logoUrl : `${base}${logoUrl}` } } : {}),
    description,
    ...(sameAs && sameAs.length > 0 ? { sameAs } : {}),
  };

  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${base}/#website`,
    url: base,
    name: siteName,
    alternateName: ALTERNATE_NAMES,
    description,
    publisher: { '@id': `${base}/#organization` },
    inLanguage: ['en', 'bn'],
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${base}/games?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Structured data has to be a raw script tag; React cannot render JSON
        // into one any other way. The content is built from our own values, not
        // user input, so there is nothing here to escape.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
      />
    </>
  );
}
