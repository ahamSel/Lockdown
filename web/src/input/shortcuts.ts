import type { ScreenName } from '../ui/screens';

export type Shortcut = 'pause' | 'resume' | 'back' | 'restart' | 'start' | 'mute';

export interface KeyInfo {
  code: string;
  repeat: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  /** The key went to a focused button, which handles Enter/Space itself. */
  onButton: boolean;
}

/** What a key press does on a screen, and whether to stop the browser's default (page scroll). */
export function shortcutFor(k: KeyInfo, screen: ScreenName): { action: Shortcut | null; preventDefault: boolean } {
  const none = { action: null, preventDefault: false };
  if (k.ctrlKey || k.metaKey || k.altKey) return none; // leave print, reload and other browser chords alone

  if (k.code === 'Enter' || k.code === 'Space') {
    if (k.onButton) return none;
    // Always stop Space from scrolling the embedding page, even while it auto-repeats.
    if (k.repeat) return { action: null, preventDefault: true };
    const action = screen === 'title' || screen === 'gameover' ? 'start' : screen === 'paused' ? 'resume' : null;
    return { action, preventDefault: true };
  }
  if (k.repeat) return none;

  switch (k.code) {
    case 'Escape':
    case 'KeyP':
      if (screen === 'playing') return { action: 'pause', preventDefault: false };
      if (screen === 'paused') return { action: 'resume', preventDefault: false };
      if (screen === 'howto') return { action: 'back', preventDefault: false };
      return none;
    case 'KeyR':
      return screen === 'playing' || screen === 'paused' || screen === 'gameover' ? { action: 'restart', preventDefault: false } : none;
    case 'KeyM':
      return { action: 'mute', preventDefault: false };
  }
  return none;
}
