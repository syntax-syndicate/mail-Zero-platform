import useBackgroundQueue from '@/hooks/ui/use-background-queue';
import { useMail } from '@/components/mail/use-mail';
import { useThreads } from '@/hooks/use-threads';
import { modifyLabels } from '@/actions/mail';
import { useStats } from '@/hooks/use-stats';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

const useMoveTo = () => {
  const t = useTranslations();
  const [isLoading, setIsLoading] = useState(false);
  const { mutate: refetchThreads } = useThreads();
  const { mutate: refetchStats } = useStats();
  const [mail, setMail] = useMail();
  const { addManyToQueue, deleteManyFromQueue } = useBackgroundQueue();

  const getCopyByDestination = (to?: string) => {
    switch (to) {
      case 'INBOX':
        return {
          loading: t('common.actions.movingToInbox'),
          success: t('common.actions.movedToInbox'),
        };
      case 'SPAM':
        return {
          loading: t('common.actions.movingToSpam'),
          success: t('common.actions.movedToSpam'),
        };
      case 'TRASH':
        return {
          loading: t('common.actions.movingToBin'),
          success: t('common.actions.movedToBin'),
        };
      case 'ARCHIVE':
        return {
          loading: t('common.actions.archiving'),
          success: t('common.actions.archived'),
        };
      default:
        return {
          loading: t('common.actions.moving'),
          success: t('common.actions.moved'),
        };
    }
  };

  const moveTo = (threadIds: string[], { to, from }: { to?: string; from?: string }) => {
    if (!to && !from) {
      throw new Error('No source or destination specified');
    }

    setIsLoading(true);
    addManyToQueue(threadIds);
    return toast.promise(
      modifyLabels({
        threadId: threadIds,
        addLabels: to ? [to] : undefined,
        removeLabels: from ? [from] : undefined,
      }),
      {
        ...getCopyByDestination(to),
        error: (error) => {
          console.error('Error moving thread(s):', error);

          return t('common.actions.failedToMove');
        },
        finally: async () => {
          setIsLoading(false);
          deleteManyFromQueue(threadIds);
          await Promise.all([refetchThreads(), refetchStats()]);
          setMail({
            ...mail,
            bulkSelected: [],
          });
        },
      },
    );
  };

  return {
    moveSelectedTo: ({ to, from }: { to?: string; from?: string }) => {
      return moveTo(mail.bulkSelected, { from, to });
    },
    moveTo,
    isLoading,
  };
};

export default useMoveTo;
