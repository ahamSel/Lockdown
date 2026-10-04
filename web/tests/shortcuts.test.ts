import { describe, expect, it } from 'vitest';
import { shortcutFor, type KeyInfo } from '../src/input/shortcuts';

const key = (code: string, extra: Partial<KeyInfo> = {}): KeyInfo => ({
  code,
  repeat: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  onButton: false,
  ...extra,
});

describe('shortcutFor', () => {
  it('maps the single-key shortcuts per screen', () => {
    expect(shortcutFor(key('Escape'), 'playing').action).toBe('pause');
    expect(shortcutFor(key('KeyP'), 'paused').action).toBe('resume');
    expect(shortcutFor(key('Escape'), 'howto').action).toBe('back');
    expect(shortcutFor(key('KeyR'), 'gameover').action).toBe('restart');
    expect(shortcutFor(key('KeyR'), 'title').action).toBeNull();
    expect(shortcutFor(key('Enter'), 'title').action).toBe('start');
    expect(shortcutFor(key('Space'), 'paused').action).toBe('resume');
    expect(shortcutFor(key('KeyM'), 'playing').action).toBe('mute');
  });

  it('ignores keys pressed with Ctrl, Cmd or Alt (print, reload, browser chords)', () => {
    for (const mod of ['ctrlKey', 'metaKey', 'altKey'] as const) {
      expect(shortcutFor(key('KeyP', { [mod]: true }), 'playing')).toEqual({ action: null, preventDefault: false });
      expect(shortcutFor(key('KeyR', { [mod]: true }), 'playing').action).toBeNull();
      expect(shortcutFor(key('KeyM', { [mod]: true }), 'playing').action).toBeNull();
    }
  });

  it('keeps a held Space from scrolling the page, without repeating the action', () => {
    expect(shortcutFor(key('Space', { repeat: true }), 'title')).toEqual({ action: null, preventDefault: true });
    expect(shortcutFor(key('Space', { repeat: true }), 'playing')).toEqual({ action: null, preventDefault: true });
  });

  it('leaves Enter and Space to a focused button', () => {
    expect(shortcutFor(key('Enter', { onButton: true }), 'title')).toEqual({ action: null, preventDefault: false });
  });
});
