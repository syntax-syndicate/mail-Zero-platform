import { atom } from 'jotai';

type ThreadId = string;

const baseBackgroundQueueAtom = atom<Record<ThreadId, number>>({});

export const backgroundQueueAtom = atom(
  (get) => get(baseBackgroundQueueAtom),
  (get, set, action: { type: 'add' | 'delete' | 'clear'; threadId?: string }) => {
    const currentQueue = get(baseBackgroundQueueAtom);
    if (action.type === 'add' && action.threadId) {
      // ADD
      set(baseBackgroundQueueAtom, {
        ...currentQueue,
        [action.threadId]: (currentQueue[action.threadId] ?? 0) + 1,
      });
    } else if (action.type === 'delete' && action.threadId) {
      // DELETE
      const current = currentQueue[action.threadId] ?? 0;
      if (current <= 1) {
        const { [action.threadId]: _, ...rest } = currentQueue;
        set(baseBackgroundQueueAtom, rest);
      } else {
        set(baseBackgroundQueueAtom, {
          ...currentQueue,
          [action.threadId]: current - 1,
        });
      }
    } else if (action.type === 'clear') {
      // CLEAR
      set(baseBackgroundQueueAtom, {});
    }
  },
);

export const addManyThreadIdsToBackgroundQueueAtom = atom(
  (get) => get(baseBackgroundQueueAtom),
  (get, set, threadIds: string[]) => {
    const currentQueue = get(baseBackgroundQueueAtom);
    set(
      baseBackgroundQueueAtom,
      threadIds.reduce((acc, threadId) => {
        acc[threadId] = (acc[threadId] ?? 0) + 1;

        return acc;
      }, currentQueue),
    );
  },
);

export const deleteManyThreadIdsFromBackgroundQueueAtom = atom(
  (get) => get(baseBackgroundQueueAtom),
  (get, set, threadIds: string[]) => {
    const currentQueue = get(baseBackgroundQueueAtom);
    set(
      baseBackgroundQueueAtom,
      threadIds.reduce((acc, threadId) => {
        const current = acc[threadId] ?? 0;
        if (current <= 1) {
          const { [threadId]: _, ...rest } = acc;

          return rest;
        }

        acc[threadId] = current - 1;

        return acc;
      }, currentQueue),
    );
  },
);

export const isThreadInBackgroundQueueAtom = atom(
  (get) => (threadId: string) => threadId in get(baseBackgroundQueueAtom),
);
