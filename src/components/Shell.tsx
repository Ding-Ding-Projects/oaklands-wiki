import type { ReactNode } from 'react';
import { href } from '../lib/routes';
import { siteConfig, hasMaintainerAbout } from '../lib/site-config';
import { readProvenance, formatBuiltAt } from '../lib/provenance';

export function Shell({ current, children }: { current: 'home' | 'about'; children: ReactNode }) {
  const provenance = readProvenance();
  return (
    <>
      <a className="ok-skip-link" href="#main">Skip to content</a>

      <header className="ok-topbar">
        <div className="ok-shell" style={{ display: 'flex', alignItems: 'center', gap: 'var(--ok-space-4)', width: '100%' }}>
          <a className="ok-topbar__title" href={href('/')}>Oaklands Wiki</a>
          <nav aria-label="Primary" style={{ marginInlineStart: 'auto', display: 'flex', gap: 'var(--ok-space-4)' }}>
            <a href={href('/')} aria-current={current === 'home' ? 'page' : undefined}>Home</a>
            <a href={href('/about')} aria-current={current === 'about' ? 'page' : undefined}>About</a>
          </nav>
        </div>
      </header>

      <main id="main" className="ok-shell">{children}</main>

      <footer className="ok-shell ok-footer">
        <p>
          An unofficial reader of the{' '}
          <a href={siteConfig.sourceWiki} rel="noopener noreferrer nofollow" referrerPolicy="no-referrer">
            {siteConfig.sourceWikiName}
          </a>
          . Not affiliated with {siteConfig.developer}, Roblox, or Fandom.
        </p>
        <p>
          Wiki content is{' '}
          <a href={siteConfig.contentLicenceUrl} rel="noopener noreferrer">{siteConfig.contentLicence}</a>
          {' '}and stays so. Site code is {siteConfig.codeLicence}.{' '}
          <a href={siteConfig.repository} rel="noopener noreferrer">Source</a>
          {hasMaintainerAbout() ? (
            <>
              {' · '}
              <a href={siteConfig.maintainerAboutUrl} rel="noopener noreferrer">About me</a>
            </>
          ) : null}
        </p>
        <p className="ok-muted">
          {provenance
            ? `Version ${provenance.version} · built ${formatBuiltAt(provenance.builtAt)} · commit ${provenance.commit.slice(0, 7)}`
            : 'Build provenance unavailable — this artifact carries no recorded version or build time.'}
        </p>
      </footer>

      <nav className="ok-bottomnav" aria-label="Primary">
        <a href={href('/')} aria-current={current === 'home' ? 'page' : undefined}>Home</a>
        <a href={href('/about')} aria-current={current === 'about' ? 'page' : undefined}>About</a>
      </nav>
    </>
  );
}
