import { create } from 'zustand';

export const useTicketStore = create((set) => ({
  tickets: [],
  kanbanColumns: {
    ToDo: [],
    InProgress: [],
    InReview: [],
    Done: []
  },
  loading: false,

  setTickets: (tickets) => {
    const columns = {
      ToDo: tickets.filter(t => t.status === 'ToDo'),
      InProgress: tickets.filter(t => t.status === 'InProgress'),
      InReview: tickets.filter(t => t.status === 'InReview'),
      Done: tickets.filter(t => t.status === 'Done')
    };
    set({ tickets, kanbanColumns: columns });
  },

  moveTicket: (ticketId, fromCol, toCol) => {
    set((state) => {
      const ticket = state.kanbanColumns[fromCol].find(t => t.id === ticketId);
      if (!ticket) return state;

      const newFromCol = state.kanbanColumns[fromCol].filter(t => t.id !== ticketId);
      const updatedTicket = { ...ticket, status: toCol };
      const newToCol = [...state.kanbanColumns[toCol], updatedTicket];

      return {
        tickets: state.tickets.map(t => t.id === ticketId ? updatedTicket : t),
        kanbanColumns: {
          ...state.kanbanColumns,
          [fromCol]: newFromCol,
          [toCol]: newToCol
        }
      };
    });
  },

  addTicket: (ticket) => {
    set((state) => ({
      tickets: [...state.tickets, ticket],
      kanbanColumns: {
        ...state.kanbanColumns,
        ToDo: [...state.kanbanColumns.ToDo, ticket]
      }
    }));
  },

  updateTicket: (updatedTicket) => {
    set((state) => {
      const newTickets = state.tickets.map(t => t.id === updatedTicket.id ? updatedTicket : t);
      // Re-calculate columns for simplicity or update specific one
      const columns = {
        ToDo: newTickets.filter(t => t.status === 'ToDo'),
        InProgress: newTickets.filter(t => t.status === 'InProgress'),
        InReview: newTickets.filter(t => t.status === 'InReview'),
        Done: newTickets.filter(t => t.status === 'Done')
      };
      return { tickets: newTickets, kanbanColumns: columns };
    });
  }
}));
