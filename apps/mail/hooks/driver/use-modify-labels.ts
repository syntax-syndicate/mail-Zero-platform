import useBackgroundQueue from '@/hooks/ui/use-background-queue';
import { useMail } from '@/components/mail/use-mail';
import { useThreads } from '@/hooks/use-threads';
import { modifyLabels } from '@/actions/mail';
import { useState, useCallback } from 'react';
import { useStats } from '@/hooks/use-stats';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

const useModifyLabels = ({
  suppressToasts = false,
}: {
  suppressToasts?: boolean;
} = {}) => {
  const t = useTranslations();
  const [isLoading, setIsLoading] = useState(false);
  const { mutate: refetchThreads } = useThreads();
  const { mutate: refetchStats } = useStats();
  const { addManyToQueue, deleteManyFromQueue } = useBackgroundQueue();
  const [mail, setMail] = useMail();

  const mutate = useCallback(
    async (threadIds: string[], addLabels: string[], removeLabels: string[]) => {
      setIsLoading(true);
      addManyToQueue(threadIds);
      await modifyLabels({
        threadId: threadIds,
        addLabels,
        removeLabels,
      });
      deleteManyFromQueue(threadIds);
      setIsLoading(false);
    },
    [],
  );

  return {
    mutate: (
      threadIds: string[],
      { addLabels, removeLabels }: { addLabels?: string[]; removeLabels?: string[] },
    ) => {
      const promise = mutate(threadIds, addLabels ?? [], removeLabels ?? []);

      if (suppressToasts) {
        promise.then(async () => {
          await Promise.all([refetchThreads(), refetchStats()]);
          setMail({
            ...mail,
            bulkSelected: [],
          });
        });

        return {
          unwrap: async () => {
            return promise;
          },
        };
      }

      return toast.promise(promise, {
        loading: t('common.actions.loading'),
        success: 'Successfully updated labels',
        error: 'Failed to update labels',
        finally: async () => {
          await Promise.all([refetchThreads(), refetchStats()]);
          setMail({
            ...mail,
            bulkSelected: [],
          });
        },
      });
    },
    mutateAsync: async function (
      threadIds: string[],
      { addLabels, removeLabels }: { addLabels?: string[]; removeLabels?: string[] },
    ) {
      return this.mutate(threadIds, {
        addLabels,
        removeLabels,
      }).unwrap();
    },
    isLoading,
  };
};

export default useModifyLabels;
