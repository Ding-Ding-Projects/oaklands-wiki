/**
 * Single source for site-wide configuration that more than one surface reads.
 *
 * `maintainerAboutUrl` is deliberately unset. An unset value renders NOTHING —
 * never a placeholder, never a guessed link. Setting it here propagates to the
 * About page, the site footer, README.md and the wiki's _Footer.md.
 */
export const siteConfig = {
  name: 'Oaklands Wiki',
  tagline: 'A reading-first encyclopedia for Oaklands.',
  repository: 'https://github.com/Ding-Ding-Projects/oaklands-wiki',
  sourceWiki: 'https://oaklands.fandom.com',
  sourceWikiName: 'Oaklands Wiki on Fandom',
  gameUrl: 'https://www.roblox.com/games/9938675423/Oaklands',
  developer: 'Typical Developers',
  contentLicence: 'CC BY-SA 4.0',
  contentLicenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  codeLicence: 'Apache-2.0',
  maintainerAboutUrl: '' as string,
} as const;

export function hasMaintainerAbout(): boolean {
  return siteConfig.maintainerAboutUrl.trim().length > 0;
}
