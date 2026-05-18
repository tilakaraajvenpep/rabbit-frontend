import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAlertStore = create(
  persist(
    (set, get) => ({
      alerts: [],
      unreadCount: 0,

      setAlerts: (alerts) => {
        const unreadCount = alerts.filter(a => !a.acknowledged).length;
        set({ alerts, unreadCount });
      },

      addAlert: (alert) => {
        set(state => {
          const newAlerts = [alert, ...state.alerts];
          return {
            alerts: newAlerts,
            unreadCount: newAlerts.filter(a => !a.acknowledged).length
          };
        });
      },

      acknowledgeAlert: (id, comment) => {
        set(state => {
          const newAlerts = state.alerts.map(a => 
            a.id === id ? { ...a, acknowledged: true, ackComment: comment, ackAt: new Date().toISOString() } : a
          );
          return {
            alerts: newAlerts,
            unreadCount: newAlerts.filter(a => !a.acknowledged).length
          };
        });
      },

      markAllRead: () => {
        set(state => ({
          alerts: state.alerts.map(a => ({ ...a, acknowledged: true })),
          unreadCount: 0
        }));
      }
    }),
    {
      name: 'rabbit-alert-storage',
    }
  )
);
