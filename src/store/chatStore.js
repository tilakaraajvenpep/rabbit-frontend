import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useChatStore = create(
  persist(
    (set, get) => ({
      sessions: [
        { id: 's1', title: 'Recent project status', date: new Date().toISOString() }
      ],
      activeSessionId: 's1',
      messages: [
        { id: 'm1', role: 'bot', type: 'text', content: 'Hello! I am your Rabbit Assistant. How can I help you today?', timestamp: new Date().toISOString() }
      ],
      isTyping: false,

      startNewSession: () => {
        const id = 's' + Date.now();
        set({
          activeSessionId: id,
          sessions: [{ id, title: 'New Conversation', date: new Date().toISOString() }, ...get().sessions],
          messages: [{ id: 'm' + Date.now(), role: 'bot', type: 'text', content: 'Hello! Starting a new conversation. What can I help you with?', timestamp: new Date().toISOString() }]
        });
      },

      selectSession: (id) => {
        set({ activeSessionId: id });
        // In mock mode, we just keep the same messages for simplicity or clear them
      },

      addMessage: (message) => {
        set(state => ({
          messages: [...state.messages, { ...message, id: 'm' + Date.now(), timestamp: new Date().toISOString() }]
        }));
      },

      setTyping: (isTyping) => set({ isTyping })
    }),
    {
      name: 'rabbit-chat-storage',
    }
  )
);
