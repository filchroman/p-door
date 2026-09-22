import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyMarks } from '../../store/derive';
import { phase2State } from '../../test/states';
import { makeUpdate, resetStore } from '../../test/updates';
import { Confetti } from './Confetti';
import { OutConfetti } from './OutConfetti';
import { VakhtaEffect } from './VakhtaEffect';

const state = phase2State({ players: [{ id: 'A', hand: '' }, { id: 'B', hand: '7C' }, { id: 'C', hand: '8C' }], trump: 'D', turn: 'B' });

beforeEach(() => resetStore({ update: makeUpdate(state, 'A'), motionEnabled: true }));

describe('celebration effects', () => {
  it('Vakhta catch: dim, flash and a 300 ms input block while fresh', () => {
    resetStore({
      update: makeUpdate(state, 'A'),
      motionEnabled: true,
      marks: { ...emptyMarks(1), seq: 1, caught: { seq: 1, at: Date.now(), offenders: ['B'], callerId: 'A' } },
    });
    const { container } = render(<VakhtaEffect />);
    expect(container.querySelector('.fx-dim')).not.toBeNull();
    expect(container.querySelector('.fx-flash')).not.toBeNull();
    expect(container.querySelector('.fx-block')).not.toBeNull();
  });

  it('an old catch shows nothing', () => {
    resetStore({
      update: makeUpdate(state, 'A'),
      marks: { ...emptyMarks(1), seq: 1, caught: { seq: 1, at: Date.now() - 10_000, offenders: ['B'], callerId: 'A' } },
    });
    const { container } = render(<VakhtaEffect />);
    expect(container).toBeEmptyDOMElement();
  });

  it('confetti is a canvas while it plays, and nothing with reduced motion or disabled animations', () => {
    const { container, unmount } = render(<Confetti burstKey={1} />);
    expect(container.querySelector('canvas.confetti')).not.toBeNull();
    unmount();
    resetStore({ motionEnabled: false });
    expect(render(<Confetti burstKey={1} />).container).toBeEmptyDOMElement();
    resetStore({ motionEnabled: true });
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }));
    expect(render(<Confetti burstKey={2} />).container).toBeEmptyDOMElement();
    vi.unstubAllGlobals();
  });

  /** Новый залп (свой burstKey) обязан запуститься и после того, как прошлый доиграл и снял canvas. */
  it('a later burst runs again after the previous one has finished', () => {
    const ctx = { clearRect() {}, save() {}, restore() {}, translate() {}, rotate() {}, fillRect() {}, fillStyle: '' };
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    const frames = vi.fn();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames();
      cb(performance.now() + 10_000);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    try {
      const { container, rerender } = render(<Confetti burstKey={1} durationMs={10} count={5} />);
      expect(frames).toHaveBeenCalledTimes(1);
      expect(container.querySelector('canvas')).toBeNull();
      rerender(<Confetti burstKey={2} durationMs={10} count={5} />);
      expect(frames).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
      getContext.mockRestore();
    }
  });

  it('confetti bursts when I go out', () => {
    resetStore({ update: makeUpdate(state, 'A'), motionEnabled: true, marks: { ...emptyMarks(1), seq: 1, outFx: { A: { seq: 1, at: Date.now() } } } });
    expect(render(<OutConfetti />).container.querySelector('canvas')).not.toBeNull();
  });

  it('no confetti when somebody else goes out', () => {
    resetStore({ update: makeUpdate(state, 'A'), motionEnabled: true, marks: { ...emptyMarks(1), seq: 1, outFx: { B: { seq: 1, at: Date.now() } } } });
    expect(render(<OutConfetti />).container.querySelector('canvas')).toBeNull();
  });
});
