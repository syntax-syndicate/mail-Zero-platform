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
  const [_mail, setMail] = useMail();
  const mutate = useCallback(
    (
      threadIds: string[],
      { addLabels = [], removeLabels = [] }: { addLabels?: string[]; removeLabels?: string[] },
    ) => {
      if (addLabels.length === 0 && removeLabels.length === 0) {
        throw new Error('No label changes specified');
      }

      setIsLoading(true);
      addManyToQueue(threadIds);
      const promise = modifyLabels({
        threadId: threadIds,
        addLabels,
        removeLabels,
      });
      return toast.promise(promise, {
        loading: t('common.actions.loading'),
        success: 'Successfully updated labels',
        error: 'Failed to update labels',
        finally: async () => {
          setMail((mail) => {
            return {
              ...mail,
              bulkSelected: [],
            };
          });
          deleteManyFromQueue(threadIds);
          setIsLoading(false);
          await Promise.all([refetchThreads(), refetchStats()]);
        },
      });
    },
    [],
  );

  return {
    mutate,
    isLoading,
  };
};

export default useModifyLabels;
