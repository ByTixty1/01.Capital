'use client';

import { useEffect, useRef, useState } from 'react';
import { useQareenStore } from '@/lib/qareen/store';
import { submitQareenUserInput } from '@/lib/qareen/executor';
import { primeAudioPlayback } from '@/lib/qareen/audio';

export function ChatPanel() {
  const conversation = useQareenStore((s) => s.conversation);
  const pendingApproval = useQareenStore((s) => s.pendingApproval);
  const voiceOutputState = useQareenStore((s) => s.voiceOutputState);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
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

    setSending(true);
    void submitQareenUserInput(trimmed).finally(() => setSending(false));
  }

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault();
    sendMessage(draft);
    setDraft('');
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

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--glass-border)' }}>
        <input
          className="glass-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={sending ? 'Thinking…' : 'Type a message'}
          disabled={sending}
          style={{ fontSize: 13, padding: '8px 10px' }}
        />
        <button type="submit" className="btn-primary" disabled={sending} style={{ padding: '8px 14px', fontSize: 13 }}>
          Send
        </button>
      </form>
    </div>
  );
}
