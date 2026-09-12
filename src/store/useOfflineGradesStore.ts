import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface OfflineNote {
  eleve_id: string;
  evaluation_id: string;
  note: number;
  professeur_id?: string;
  saved_at: string;
  is_synced: boolean;
}

interface OfflineGradesState {
  offlineQueue: OfflineNote[];
  addNodeToQueue: (note: OfflineNote) => void;
  removeNodeFromQueue: (eleve_id: string, evaluation_id: string) => void;
  clearQueue: () => void;
  getPendingNotes: () => OfflineNote[];
}

export const useOfflineGradesStore = create<OfflineGradesState>()(
  persist(
    (set, get) => ({
      offlineQueue: [],
      
      addNodeToQueue: (newNote) => set((state) => {
        // Remplacer si existe déjà pour le même élève + éval
        const filtered = state.offlineQueue.filter(
          n => !(n.eleve_id === newNote.eleve_id && n.evaluation_id === newNote.evaluation_id)
        );
        return { offlineQueue: [...filtered, newNote] };
      }),
      
      removeNodeFromQueue: (eleve_id, evaluation_id) => set((state) => ({
        offlineQueue: state.offlineQueue.filter(
          n => !(n.eleve_id === eleve_id && n.evaluation_id === evaluation_id)
        )
      })),

      clearQueue: () => set({ offlineQueue: [] }),
      
      getPendingNotes: () => get().offlineQueue.filter(n => !n.is_synced),
    }),
    {
      name: 'edumatrix-offline-grades', // Clé locale (localStorage)
    }
  )
);
