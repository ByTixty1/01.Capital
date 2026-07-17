'use client';

import { useQareenStore } from '@/lib/qareen/store';
import { useQareenVoice } from '@/hooks/useQareenVoice';
import { primeAudioPlayback } from '@/lib/qareen/audio';
import { interruptQareenOutput } from '@/lib/qareen/executor';
import { submitQareenComposerDraft } from '@/lib/qareen/composer';

export function FloatingControls() {
  useQareenVoice();

  const summoned = useQareenStore((s) => s.summoned);
  const setSummoned = useQareenStore((s) => s.setSummoned);
  const micMasterOn = useQareenStore((s) => s.micMasterOn);
  const setMicMasterOn = useQareenStore((s) => s.setMicMasterOn);
  const micState = useQareenStore((s) => s.micState);
  const guideMode = useQareenStore((s) => s.guideMode);
  const toggleGuideMode = useQareenStore((s) => s.toggleGuideMode);

  // micState already reflects reality on its own — it goes 'live' for
  // push-to-talk too, independent of the master toggle, so the indicator
  // must read it directly rather than gating on micMasterOn as well.
  const dotColor =
    micState === 'muted' ? 'var(--text-tertiary)' : micState === 'thinking' ? 'var(--warn)' : 'var(--pos)';

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 60, display: 'flex', gap: 12, alignItems: 'center' }}>
      <button
        type="button"
        className="btn-primary"
        data-testid="guide-mode-toggle"
        style={{
          borderRadius: 'var(--radius-full)',
          padding: '10px 18px',
          fontSize: 13,
          borderColor: guideMode ? 'var(--brand-purple)' : undefined,
          color: guideMode ? 'var(--brand-purple-hover)' : undefined,
        }}
        onClick={toggleGuideMode}
        aria-pressed={guideMode}
      >
        {guideMode ? 'Guided' : 'Guide me'}
      </button>

      <button
        type="button"
        className="btn-primary"
        data-testid="mic-toggle"
        style={{
          borderRadius: 'var(--radius-full)',
          width: 44,
          height: 44,
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={() => {
          if (!primeAudioPlayback()) {
            useQareenStore.getState().setVoiceOutputState('unavailable');
          }
          if (micMasterOn) {
            setMicMasterOn(false);
            // Let the voice hook detach recognition callbacks before reading
            // and submitting the completed draft. Audio was primed by this
            // click, preserving Safari's user-gesture requirement.
            setTimeout(() => submitQareenComposerDraft(), 0);
          } else {
            interruptQareenOutput();
            setMicMasterOn(true);
          }
        }}
        aria-pressed={micMasterOn}
        aria-label={micMasterOn ? 'Stop Qareen dictation' : 'Start Qareen dictation'}
        title={micMasterOn ? 'Stop dictation and send this message.' : 'Start dictation. Pauses will not send your message.'}
      >
        <span
          data-testid="mic-dot"
          data-state={micState}
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: dotColor,
            boxShadow: micState === 'live' ? '0 0 0 4px var(--brand-purple-subtle)' : 'none',
            transition: 'box-shadow 200ms',
          }}
        />
      </button>

      <button
        type="button"
        className="btn-primary"
        data-testid="summon-toggle"
        style={{ borderRadius: 'var(--radius-full)', padding: '10px 18px', fontSize: 13 }}
        onClick={() => setSummoned(!summoned)}
      >
        {summoned ? 'Dismiss Qareen' : 'Summon Qareen'}
      </button>
    </div>
  );
}
