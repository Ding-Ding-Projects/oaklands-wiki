import { href } from '../lib/routes';

export type Hero = { file: string; width: number | null; height: number | null } | null;

/**
 * An article's image, or an honest empty state.
 *
 * Never renders an `<img>` for an image the archive does not hold: a broken
 * image tag looks like a fault in the site rather than a gap in the archive, and
 * the two deserve to look different.
 *
 * `width` and `height` are set when known so the layout does not jump as images
 * arrive — the single most noticeable difference between a modern image-forward
 * page and one that shudders while it loads.
 */
export function Thumb({ hero, alt, className }: { hero: Hero; alt: string; className?: string }) {
  if (!hero) {
    return (
      <span className={className} aria-hidden="true" data-empty="true">
        <span className="ok-thumb-empty">{alt.slice(0, 1).toUpperCase()}</span>
      </span>
    );
  }
  return (
    <span className={className}>
      <img
        src={href(`/media/${hero.file}`)}
        alt={alt}
        width={hero.width ?? undefined}
        height={hero.height ?? undefined}
        loading="lazy"
        decoding="async"
      />
    </span>
  );
}
