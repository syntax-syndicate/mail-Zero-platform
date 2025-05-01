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
    addToQueue: (threadId: string) => setBackgroundQueue({ type: 'add', threadId }),
    deleteFromQueue: (threadId: string) => setBackgroundQueue({ type: 'delete', threadId }),
    clearQueue: () => setBackgroundQueue({ type: 'clear' }),
    addManyToQueue: (threadIds: string[]) => addManyThreadIdsToBackgroundQueue(threadIds),
    deleteManyFromQueue: (threadIds: string[]) => deleteManyThreadIdsFromBackgroundQueue(threadIds),
    queue: backgroundQueue,
  };
};

export default useBackgroundQueue;
