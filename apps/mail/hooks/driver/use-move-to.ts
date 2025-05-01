import useBackgroundQueue from '@/hooks/ui/use-background-queue';
import useModifyLabels from '@/hooks/driver/use-modify-labels';
import { useMail } from '@/components/mail/use-mail';
import { useThreads } from '@/hooks/use-threads';
import { useStats } from '@/hooks/use-stats';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

const useMoveTo = () => {
  const t = useTranslations();
  const { mutate: refetchThreads } = useThreads();
  const { mutate: refetchStats } = useStats();
  const [mail, setMail] = useMail();
  const { mutateAsync: modifyLabels, isLoading } = useModifyLabels({
    suppressToasts: true,
  });

  const getCopyByDestination = (to?: string) => {
    switch (to) {
      case 'inbox':
        return {
          loading: t('common.actions.movingToInbox'),
          success: t('common.actions.movedToInbox'),
          error: t('common.actions.failedToMove'),
        };
      case 'spam':
        return {
          loading: t('common.actions.movingToSpam'),
          success: t('common.actions.movedToSpam'),
          error: t('common.actions.failedToMove'),
        };
      case 'bin':
        return {
          loading: t('common.actions.movingToBin'),
          success: t('common.actions.movedToBin'),
          error: t('common.actions.failedToMove'),
        };
      case 'archive':
        return {
          loading: t('common.actions.archiving'),
          success: t('common.actions.archived'),
          error: t('common.actions.failedToMove'),
        };
      default:
        return {
          loading: t('common.actions.moving'),
          success: t('common.actions.moved'),
          error: t('common.actions.failedToMove'),
        };
    }
  };

  return {
    moveSelectedTo: function ({ to, from }: { to?: string; from?: string }) {
      return this.moveTo(mail.bulkSelected, { from, to });
    },
    moveTo: (threadIds: string[], { to, from }: { to?: string; from?: string }) => {
      if (!to && !from) {
        return {
          unwrap: () => Promise.resolve(),
        };
      }

      const promise = modifyLabels(threadIds, {
        addLabels: to ? [to] : undefined,
        removeLabels: from ? [from] : undefined,
      });

      return toast.promise(promise, {
        ...getCopyByDestination(to),
        finally: async () => {
          await Promise.all([refetchThreads(), refetchStats()]);
          setMail({
            ...mail,
            bulkSelected: [],
          });
        },
      });
    },
    isLoading,
  };
};

export default useMoveTo;
