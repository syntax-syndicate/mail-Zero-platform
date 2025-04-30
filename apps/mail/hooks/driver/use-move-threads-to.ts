import useBackgroundQueue from '@/hooks/ui/use-background-queue';
import { useMail } from '@/components/mail/use-mail';
import { moveThreadsTo } from '@/lib/thread-actions';
import { useThreads } from '@/hooks/use-threads';
import { useState, useCallback } from 'react';
import { useStats } from '@/hooks/use-stats';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export type ThreadLocation = 'inbox' | 'archive' | 'spam' | 'bin';

const useMoveThreadsTo = () => {
  const t = useTranslations();
  const [isLoading, setIsLoading] = useState(false);
  const { addManyToQueue, deleteManyFromQueue } = useBackgroundQueue();
  const { mutate: refetchThreads } = useThreads();
  const { mutate: refetchStats } = useStats();
  const [mail, setMail] = useMail();

  const mutate = useCallback(
    async (threadIds: string[], source: string, destination: ThreadLocation) => {
      setIsLoading(true);
      addManyToQueue(threadIds);
      await moveThreadsTo({
        threadIds,
        currentFolder: source,
        destination,
      });
      deleteManyFromQueue(threadIds);
      setIsLoading(false);
    },
    [],
  );

  return {
    mutate: (threadIds: string[], source: string, destination: ThreadLocation) => {
      const promise = mutate(threadIds, source, destination);

      const loadingMap = {
        inbox: t('common.actions.movingToInbox'),
        spam: t('common.actions.movingToSpam'),
        bin: t('common.actions.movingToBin'),
        archive: t('common.actions.archiving'),
      } satisfies Record<ThreadLocation, string>;

      const successMap = {
        inbox: t('common.actions.movedToInbox'),
        spam: t('common.actions.movedToSpam'),
        bin: t('common.actions.movedToBin'),
        archive: t('common.actions.archived'),
      } satisfies Record<ThreadLocation, string>;

      const errorMap = {
        inbox: t('common.actions.failedToMove'),
        spam: t('common.actions.failedToMove'),
        bin: t('common.actions.failedToMove'),
        archive: t('common.actions.failedToMove'),
      } satisfies Record<ThreadLocation, string>;

      // Return so that the caller may still call unwrap to await
      return toast.promise(promise, {
        loading: loadingMap[destination],
        success: successMap[destination],
        error: errorMap[destination],
        finally: async () => {
          await Promise.all([refetchThreads(), refetchStats()]);
          setMail({
            ...mail,
            bulkSelected: [],
          });
        },
      });
    },
    mutateAsync: async function (threadIds: string[], source: string, destination: ThreadLocation) {
      await this.mutate(threadIds, source, destination).unwrap();
    },
    isLoading,
  };
};

export default useMoveThreadsTo;
