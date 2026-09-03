/**
 * Theme control.
 *
 * Deliberately NOT a React component with state. Article pages ship no
 * JavaScript bundle at all — they are static text — so a React-driven toggle
 * would render there as a button that does nothing, which is exactly the
 * decorative-control defect the design rules forbid.
 *
 * Instead this renders plain markup and `scripts/prerender.mjs` injects a small
 * inline script into every page that applies the stored theme before first paint
 * and wires this button. About a kilobyte, works on all 1,128 pages, and no page
 * needs the bundle to make it function.
 */
export const THEME_BUTTON_ID = 'ok-theme-toggle';

export function ThemeToggle() {
  return (
    <button
      type="button"
      id={THEME_BUTTON_ID}
      className="ok-chip"
      // Replaced by the inline script the moment it runs; this is the correct
      // label for the shipped default rather than a guess about the visitor.
      aria-label="Switch to light theme"
      data-theme-label-dark="◐ Light"
      data-theme-label-light="◑ Dark"
    >
      ◐ Light
    </button>
  );
}

/**
 * The inline script, as a string so the prerenderer can embed it.
 * It runs before paint, so a returning visitor never sees the wrong theme flash.
 */
export const THEME_INLINE_SCRIPT = `(function(){
  var KEY='oaklands.theme';
  var root=document.documentElement;
  function resolve(){
    try{var s=localStorage.getItem(KEY);if(s==='light'||s==='dark')return s;}catch(e){}
    return window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';
  }
  function apply(t){
    root.setAttribute('data-theme',t);
    var b=document.getElementById('${THEME_BUTTON_ID}');
    if(!b)return;
    var next=t==='dark'?'light':'dark';
    b.textContent=t==='dark'?b.getAttribute('data-theme-label-dark'):b.getAttribute('data-theme-label-light');
    b.setAttribute('aria-label','Switch to '+next+' theme');
  }
  var current=resolve();
  apply(current);
  document.addEventListener('DOMContentLoaded',function(){
    apply(current);
    var b=document.getElementById('${THEME_BUTTON_ID}');
    if(!b)return;
    b.addEventListener('click',function(){
      current=current==='dark'?'light':'dark';
      try{localStorage.setItem(KEY,current);}catch(e){}
      apply(current);
    });
  });
})();`;
