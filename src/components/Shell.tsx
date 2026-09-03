import type { ReactNode } from 'react';
import { href } from '../lib/routes';
import { siteConfig, hasMaintainerAbout } from '../lib/site-config';
import { readProvenance, formatBuiltAt } from '../lib/provenance';
import { ThemeToggle } from './ThemeToggle';

export function Shell({ current, children }: { current: 'home' | 'about' | 'browse' | 'compare'; children: ReactNode }) {
  const provenance = readProvenance();
  const nav: { id: typeof current; label: string; to: string }[] = [
    { id: 'home', label: 'Home', to: '/' },
    { id: 'browse', label: 'Browse', to: '/browse/' },
    { id: 'compare', label: 'Compare', to: '/compare/' },
    { id: 'about', label: 'About', to: '/about/' },
  ];

  return (
    <>
      <a className="ok-skip-link" href="#main">Skip to content</a>

      <header className="ok-topbar">
        <div className="ok-shell ok-topbar__inner">
          <a className="ok-topbar__title" href={href('/')}>
            <span className="ok-topbar__mark" aria-hidden="true" />
            Oaklands
          </a>
          <nav className="ok-topbar__nav" aria-label="Primary">
            {nav.map((item) => (
              <a key={item.id} href={href(item.to)} aria-current={current === item.id ? 'page' : undefined}>
                {item.label}
              </a>
            ))}
          </nav>
          <ThemeToggle />
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
          <a href={siteConfig.contentLicenceUrl} rel="noopener noreferrer license">{siteConfig.contentLicence}</a>
          {' '}and stays so. Site code is {siteConfig.codeLicence}.{' '}
          <a href={siteConfig.repository} rel="noopener noreferrer">Source</a>
          {' · '}
          <a href={`${siteConfig.repository}/wiki`} rel="noopener noreferrer">Wiki mirror</a>
          {hasMaintainerAbout() ? (
            <>{' · '}<a href={siteConfig.maintainerAboutUrl} rel="noopener noreferrer">About me</a></>
          ) : null}
        </p>
        <p className="ok-muted" style={{ fontSize: 'var(--ok-size-micro)' }}>
          {provenance
            ? `Version ${provenance.version} · built ${formatBuiltAt(provenance.builtAt)} · commit ${provenance.commit.slice(0, 7)}`
            : 'Build provenance unavailable — this artifact carries no recorded version or build time.'}
        </p>
      </footer>

      <nav className="ok-bottomnav" aria-label="Primary">
        {nav.map((item) => (
          <a key={item.id} href={href(item.to)} aria-current={current === item.id ? 'page' : undefined}>
            {item.label}
          </a>
        ))}
      </nav>
    </>
  );
}
