import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSfx } from '../src/audio/sfx';

afterEach(() => vi.unstubAllGlobals());

function fakeAudio(state: string) {
  const resume = vi.fn(async () => {});
  class FakeContext {
    state = state;
    currentTime = 0;
    destination = {};
    resume = resume;
    createGain() {
      return { gain: { value: 0, setTargetAtTime() {} }, connect() {} };
    }
  }
  vi.stubGlobal('window', { AudioContext: FakeContext });
  return resume;
}

describe('sfx unlock', () => {
  it('resumes a context iOS left "interrupted" after a call or app switch', () => {
    const resume = fakeAudio('interrupted');
    createSfx().unlock();
    expect(resume).toHaveBeenCalled();
  });

  it('leaves a running context alone', () => {
    const resume = fakeAudio('running');
    createSfx().unlock();
    expect(resume).not.toHaveBeenCalled();
  });
});
