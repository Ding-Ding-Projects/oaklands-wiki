/**
 * Running version and that exact version's build provenance.
 *
 * Both values come from metadata bound to the artifact that is running — they
 * are injected at build time from package.json and the real git commit. Neither
 * is launch time, a file timestamp, or a hand-entered label. When provenance is
 * missing or invalid the surface shows an honest unavailable state rather than
 * inventing a time.
 */
declare const __BUILD_PROVENANCE__: {
  version: string;
  commit: string;
  builtAtIso: string;
} | null;

export type Provenance = {
  version: string;
  commit: string;
  builtAt: Date;
};

export function readProvenance(): Provenance | null {
  const raw = typeof __BUILD_PROVENANCE__ === 'undefined' ? null : __BUILD_PROVENANCE__;
  if (!raw || !raw.version || !raw.builtAtIso) return null;
  const builtAt = new Date(raw.builtAtIso);
  if (Number.isNaN(builtAt.getTime())) return null;
  return { version: raw.version, commit: raw.commit, builtAt };
}

/** Date and local time including seconds, with the timezone labelled. */
export function formatBuiltAt(builtAt: Date): string {
  const formatter = new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZoneName: 'short', hour12: false,
  });
  return formatter.format(builtAt);
}
