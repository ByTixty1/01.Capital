'use client';

import { useEffect, useRef } from 'react';
import { useQareenStore } from '@/lib/qareen/store';
import { primeAudioPlayback } from '@/lib/qareen/audio';
import { submitQareenComposerDraft, submitQareenMessage } from '@/lib/qareen/composer';

export function ChatPanel() {
  const conversation = useQareenStore((s) => s.conversation);
  const pendingApproval = useQareenStore((s) => s.pendingApproval);
  const voiceOutputState = useQareenStore((s) => s.voiceOutputState);
  const micState = useQareenStore((s) => s.micState);
  const draft = useQareenStore((s) => s.composerDraft);
  const setDraft = useQareenStore((s) => s.setComposerDraft);
  const sending = useQareenStore((s) => s.composerSubmitting);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [conversation]);

  // One codepath for every input surface (typed, chip, voice): append the
  // user's message and hand it to the executor, which itself resolves any
  // pending approval and enforces the constitution — see executor.ts.
  function sendMessage(text: string): void {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    if (!primeAudioPlayback()) {
      useQareenStore.getState().setVoiceOutputState('unavailable');
    }

    submitQareenMessage(trimmed);
  }

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault();
    // Sending ends dictation first so Qareen cannot transcribe its own TTS.
    useQareenStore.getState().setMicMasterOn(false);
    if (!primeAudioPlayback()) {
      useQareenStore.getState().setVoiceOutputState('unavailable');
    }
    submitQareenComposerDraft();
  }

  return (
    <div
      className="glass-panel"
      style={{
        position: 'fixed',
        bottom: 88,
        right: 24,
        width: 340,
        maxHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 55,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--glass-border)',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
        }}
      >
        Qareen
        <span
          data-testid="voice-output-state"
          data-state={voiceOutputState}
          style={{ float: 'right', color: voiceOutputState === 'unavailable' ? 'var(--neg)' : 'var(--text-tertiary)' }}
        >
          {voiceOutputState === 'speaking' ? 'Speaking' : voiceOutputState === 'unavailable' ? 'Voice unavailable' : 'Voice ready'}
        </span>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {conversation.length === 0 && (
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
            Ask about your company, or say "how do I check my profit."
          </p>
        )}
        {conversation.map((entry) => (
          <div key={entry.id} style={{ alignSelf: entry.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
            <div
              data-testid={entry.role === 'qareen' ? 'qareen-assistant-message' : 'qareen-user-message'}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                background: entry.role === 'user' ? 'var(--brand-purple-subtle)' : 'var(--bg-elevated)',
                color: entry.role === 'user' ? 'var(--brand-purple-hover)' : 'var(--text-primary)',
                fontSize: 13,
                lineHeight: 1.45,
              }}
            >
              {entry.text}
            </div>
            {entry.needsApproval && entry.approvalState === 'pending' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button type="button" className="btn-primary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => sendMessage('Yes')}>
                  Approve
                </button>
                <button type="button" className="btn-primary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => sendMessage('No')}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {pendingApproval && (
        <div
          style={{
            padding: '8px 16px',
            background: 'var(--brand-purple-subtle)',
            color: 'var(--brand-purple-hover)',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          Awaiting your approval — {pendingApproval.preparedAction}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: 12, borderTop: '1px solid var(--glass-border)' }}>
        <textarea
          data-testid="qareen-message-input"
          className="glass-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={sending ? 'Thinking…' : micState === 'live' ? 'Listening… stop the mic to send' : 'Type a message'}
          disabled={sending}
          rows={2}
          aria-label="Message Qareen"
          style={{ fontSize: 13, lineHeight: 1.45, padding: '8px 10px', minHeight: 40, maxHeight: 120, resize: 'vertical' }}
        />
        <button type="submit" className="btn-primary" disabled={sending} style={{ padding: '8px 14px', fontSize: 13 }}>
          Send
        </button>
      </form>
    </div>
  );
}
