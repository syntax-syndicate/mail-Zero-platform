import {
  backgroundQueueAtom,
  addManyThreadIdsToBackgroundQueueAtom,
  deleteManyThreadIdsFromBackgroundQueueAtom,
} from '@/store/backgroundQueue';
import { useAtom, useSetAtom } from 'jotai';

const useBackgroundQueue = () => {
  const [backgroundQueue, setBackgroundQueue] = useAtom(backgroundQueueAtom);
  const addManyThreadIdsToBackgroundQueue = useSetAtom(addManyThreadIdsToBackgroundQueueAtom);
  const deleteManyThreadIdsFromBackgroundQueue = useSetAtom(
    deleteManyThreadIdsFromBackgroundQueueAtom,
  );

  return {
    addToQueue: (threadId: string) =>
      setBackgroundQueue({
        type: 'add',
        threadId: threadId.startsWith('thread:') ? threadId : `thread:${threadId}`,
      }),
    deleteFromQueue: (threadId: string) =>
      setBackgroundQueue({
        type: 'delete',
        threadId: threadId.startsWith('thread:') ? threadId : `thread:${threadId}`,
      }),
    clearQueue: () => setBackgroundQueue({ type: 'clear' }),
    addManyToQueue: (threadIds: string[]) =>
      addManyThreadIdsToBackgroundQueue(
        threadIds.map((id) => (id.startsWith('thread:') ? id : `thread:${id}`)),
      ),
    deleteManyFromQueue: (threadIds: string[]) =>
      deleteManyThreadIdsFromBackgroundQueue(
        threadIds.map((id) => (id.startsWith('thread:') ? id : `thread:${id}`)),
      ),
    queue: backgroundQueue,
  };
};

export default useBackgroundQueue;
