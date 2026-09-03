import { Shell } from '../components/Shell';
import { siteConfig, hasMaintainerAbout } from '../lib/site-config';
import { readProvenance, formatBuiltAt } from '../lib/provenance';
import index from '../../data/category-index.json';

export function About() {
  const provenance = readProvenance();
  return (
    <Shell current="about">
      <p className="ok-eyebrow">About</p>
      <h1>About this site</h1>

      <div className="ok-prose" style={{ marginBlockStart: 'var(--ok-space-5)' }}>
        <p className="ok-lede">
          A redesigned, reading-first archive of the Oaklands community wiki. It exists because
          the source wiki is hard to read — especially on a phone.
        </p>

        <h2>What this is not</h2>
        <p>
          This is an <strong>unofficial</strong> reader. It is <strong>not affiliated</strong> with{' '}
          {siteConfig.developer}, Roblox, or Fandom, and it is not the official Oaklands wiki. It is
          a dated snapshot rather than a live mirror, so it will drift from the source between
          captures.
        </p>

        <h2>Where the content comes from</h2>
        <p>
          Articles are imported from the{' '}
          <a href={siteConfig.sourceWiki} rel="noopener noreferrer nofollow" referrerPolicy="no-referrer">
            {siteConfig.sourceWikiName}
          </a>{' '}
          through its public MediaWiki API, which that wiki&rsquo;s <code>robots.txt</code> explicitly
          permits. The snapshot behind this build was captured{' '}
          <strong>{new Date(index.capturedAt).toISOString()}</strong> and records{' '}
          {index.articles.toLocaleString()} articles across {index.pages.toLocaleString()} pages.
        </p>

        <h2>Licensing</h2>
        <p>
          Wiki text and media are{' '}
          <a href={siteConfig.contentLicenceUrl} rel="noopener noreferrer">{siteConfig.contentLicence}</a>{' '}
          and remain so here, with attribution — title, contributors, revision and timestamp —
          carried on every article. The <strong>site code</strong> is separately licensed under{' '}
          {siteConfig.codeLicence}; the two are not the same licence and are not interchangeable.
        </p>

        <h2>Corrections and takedowns</h2>
        <p>
          Content questions belong upstream on the source wiki, which is where edits actually take
          effect. For a problem with this archive specifically — a rights concern, a bad import, a
          takedown request — open an issue on the{' '}
          <a href={siteConfig.repository} rel="noopener noreferrer">repository</a>.
        </p>

        <h2>What is built so far</h2>
        <p>
          Honestly: not much yet. This phase delivers the hosted site, the design system, the
          category index and the import policy check. Article pages, browsing, search, media and
          the wiki mirror all come later, and this page will say so until they land rather than
          implying otherwise.
        </p>

        {hasMaintainerAbout() ? (
          <>
            <h2>Maintainer</h2>
            <p>
              <a href={siteConfig.maintainerAboutUrl} rel="noopener noreferrer">About me</a>
            </p>
          </>
        ) : null}

        <h2>This build</h2>
        <p className="ok-muted">
          {provenance
            ? `Version ${provenance.version}, built ${formatBuiltAt(provenance.builtAt)}, from commit ${provenance.commit}.`
            : 'Build provenance is unavailable for this artifact. No version or build time is recorded, and none is invented here.'}
        </p>
      </div>
    </Shell>
  );
}
