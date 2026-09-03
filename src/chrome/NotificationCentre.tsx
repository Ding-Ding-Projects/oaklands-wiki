import { useEffect, useState } from 'react';

export type Notice = {
  id: string;
  at: Date;
  kind: 'info' | 'success' | 'warning' | 'error';
  title: string;
  body?: string;
  action?: { label: string; run: () => void };
};

const ICON: Record<Notice['kind'], string> = {
  info: 'ℹ', success: '✓', warning: '⚠', error: '✕',
};

/**
 * Non-blocking notifications plus a reviewable centre.
 *
 * Informational and success notices auto-dismiss; warnings and errors stay until
 * dismissed, because the ones worth reading are exactly the ones that must not
 * vanish while somebody is looking elsewhere. Dismissed notices remain in the
 * centre, so nothing is lost by not catching it in time.
 */
export function NotificationCentre({
  notices,
  onDismiss,
}: {
  notices: Notice[];
  onDismiss: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState<string[]>([]);

  useEffect(() => {
    const transient = notices.filter((n) => n.kind === 'info' || n.kind === 'success');
    setVisible(notices.map((n) => n.id));
    if (transient.length === 0) return;
    const timers = transient.map((notice) =>
      setTimeout(() => setVisible((current) => current.filter((id) => id !== notice.id)), 6000),
    );
    return () => timers.forEach(clearTimeout);
  }, [notices]);

  const live = notices.filter((n) => visible.includes(n.id));

  return (
    <>
      <button
        type="button"
        className="ok-chip"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        🔔 {notices.length}
      </button>

      {/* Toasts. Anchored bottom-right, never modal, never blocking. */}
      <div className="ok-toasts" role="region" aria-label="Notifications">
        {live.map((notice) => (
          <div key={notice.id} className="ok-toast" data-kind={notice.kind} role={notice.kind === 'error' ? 'alert' : 'status'}>
            <span className="ok-toast__icon" aria-hidden="true">{ICON[notice.kind]}</span>
            <span className="ok-toast__text">
              <strong>{notice.title}</strong>
              {notice.body ? <span>{notice.body}</span> : null}
            </span>
            {notice.action ? (
              <button type="button" className="ok-chip" onClick={notice.action.run}>{notice.action.label}</button>
            ) : null}
            <button
              type="button"
              className="ok-toast__dismiss"
              aria-label={`Dismiss: ${notice.title}`}
              onClick={() => setVisible((c) => c.filter((id) => id !== notice.id))}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {open ? (
        <div className="ok-sheet" role="dialog" aria-label="Notification centre">
          <div className="ok-sheet__head">
            <h2>Notifications</h2>
            <button type="button" className="ok-chip" onClick={() => setOpen(false)}>Close</button>
          </div>
          {notices.length === 0 ? (
            <p className="ok-muted">Nothing yet. Notices appear here whether or not you caught them on screen.</p>
          ) : (
            <ul className="ok-rows">
              {notices.map((notice) => (
                <li key={notice.id}>
                  <div className="ok-row" style={{ cursor: 'default' }}>
                    <span aria-hidden="true">{ICON[notice.kind]}</span>
                    <span className="ok-row__name">
                      {notice.title}
                      {notice.body ? <span className="ok-muted"> — {notice.body}</span> : null}
                    </span>
                    <span className="ok-row__meta">
                      {notice.at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button type="button" className="ok-chip" onClick={() => onDismiss(notice.id)}>Remove</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </>
  );
}
