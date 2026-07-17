'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ConversationEntry, MicState } from './types';

export interface FormDraft {
  field_name?: string;
  field_id?: string;
  field_shares?: string;
}

export interface PendingApproval {
  preparedAction: string;
  conversationEntryId: string;
}

/** A stakeholder added during this demo session — local-only, never the
 * real API (see ADR-0009 / architecture decision #7: Qareen never
 * mutates production data). */
export interface SessionStakeholder {
  id: string;
  name: string;
  role: string;
  percentage: number;
}

interface QareenState {
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;

  /** false = text-only chat, no hand motion, no auto-navigation. See ADR #9. */
  guideMode: boolean;
  setGuideMode: (value: boolean) => void;
  toggleGuideMode: () => void;

  micState: MicState;
  setMicState: (state: MicState) => void;

  micMasterOn: boolean;
  setMicMasterOn: (on: boolean) => void;

  voiceOutputState: 'idle' | 'speaking' | 'unavailable';
  setVoiceOutputState: (state: 'idle' | 'speaking' | 'unavailable') => void;

  conversation: ConversationEntry[];
  appendConversationEntry: (entry: ConversationEntry) => void;
  updateConversationEntry: (id: string, patch: Partial<ConversationEntry>) => void;
  clearConversation: () => void;

  pendingApproval: PendingApproval | null;
  setPendingApproval: (approval: PendingApproval | null) => void;

  formDraft: FormDraft;
  setFormDraftField: (field: keyof FormDraft, value: string) => void;
  clearFormDraft: () => void;

  sessionStakeholders: SessionStakeholder[];
  /** Commits the current formDraft as a new stakeholder — local session
   * state only. Returns false (no-op) if there's nothing to commit. */
  commitStakeholderFromDraft: () => boolean;

  summoned: boolean;
  setSummoned: (value: boolean) => void;
}

export const useQareenStore = create<QareenState>()(
  persist(
    (set, get) => ({
      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),

      guideMode: true,
      setGuideMode: (value) => set({ guideMode: value }),
      toggleGuideMode: () => set((s) => ({ guideMode: !s.guideMode })),

      micState: 'muted',
      setMicState: (state) => set({ micState: state }),

      micMasterOn: false,
      setMicMasterOn: (on) => set({ micMasterOn: on }),

      voiceOutputState: 'idle',
      setVoiceOutputState: (state) => set({ voiceOutputState: state }),

      conversation: [],
      appendConversationEntry: (entry) =>
        set((s) => ({ conversation: [...s.conversation, entry] })),
      updateConversationEntry: (id, patch) =>
        set((s) => ({
          conversation: s.conversation.map((entry) =>
            entry.id === id ? { ...entry, ...patch } : entry
          ),
        })),
      clearConversation: () => set({ conversation: [] }),

      pendingApproval: null,
      setPendingApproval: (approval) => set({ pendingApproval: approval }),

      formDraft: {},
      setFormDraftField: (field, value) =>
        set((s) => ({ formDraft: { ...s.formDraft, [field]: value } })),
      clearFormDraft: () => set({ formDraft: {} }),

      sessionStakeholders: [],
      commitStakeholderFromDraft: () => {
        const { formDraft, sessionStakeholders } = get();
        if (!formDraft.field_name?.trim()) return false;
        const newStakeholder: SessionStakeholder = {
          id: `session-${Date.now()}`,
          name: formDraft.field_name.trim(),
          role: 'Added via Qareen',
          percentage: Number(formDraft.field_shares) || 0,
        };
        set({ sessionStakeholders: [...sessionStakeholders, newStakeholder], formDraft: {} });
        return true;
      },

      // Site-wide feature now (ADR-0010) — starts hidden, not intrusive on
      // every real page load. The nav icon summons it explicitly.
      summoned: false,
      setSummoned: (value) => set(value ? { summoned: true, guideMode: true } : { summoned: false }),
    }),
    {
      name: 'qareen-session',
      version: 2,
      migrate: (persistedState, version) => {
        const state = persistedState as Partial<QareenState>;
        // v1 defaulted to text-only, which made summoned hands look broken
        // unless the user separately discovered "Guide me".
        return version < 2 ? { ...state, guideMode: true } : state;
      },
      storage: createJSONStorage(() => sessionStorage),
      // Skip auto-hydration at store-creation time (would throw on the server,
      // where `sessionStorage` doesn't exist) — rehydrated explicitly via
      // useQareenHydration() inside a client-only effect instead.
      skipHydration: true,
      partialize: (s) => ({
        guideMode: s.guideMode,
        conversation: s.conversation,
        formDraft: s.formDraft,
        sessionStakeholders: s.sessionStakeholders,
        pendingApproval: s.pendingApproval,
        summoned: s.summoned,
        micMasterOn: s.micMasterOn,
      }),
    }
  )
);

/** Call once from QareenPresence (mounted in the root layout) to rehydrate
 * session state after refresh. */
export function useQareenHydration(): boolean {
  const hasHydrated = useQareenStore((s) => s.hasHydrated);

  useEffect(() => {
    void Promise.resolve(useQareenStore.persist.rehydrate()).then(() => {
      useQareenStore.getState().setHasHydrated(true);
    });
  }, []);

  return hasHydrated;
}
