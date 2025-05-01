import { useConfirmDialog } from '@/components/context/confirmation-dialog-context';
import useBackgroundQueue from '@/hooks/ui/use-background-queue';
import { useMail } from '@/components/mail/use-mail';
import { useThreads } from '@/hooks/use-threads';
import { deleteThread } from '@/actions/mail';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

const useDelete = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [_mail, setMail] = useMail();
  const { mutate: refetchThreads } = useThreads();
  const t = useTranslations();
  const { confirm } = useConfirmDialog();
  const { addToQueue, deleteFromQueue } = useBackgroundQueue();

  const mutate = async (id: string, type: 'thread' | 'email' = 'thread') => {
    try {
      setIsLoading(true);
      addToQueue(id);
      await deleteThread({
        id,
      });
      setMail((prev) => {
        return {
          ...prev,
          bulkSelected: [],
        };
      });
      await refetchThreads();
    } catch (error) {
      console.error(`Error deleting ${type}:`, error);

      throw error;
    } finally {
      deleteFromQueue(id);
      setIsLoading(false);
    }
  };

  return {
    mutate: (id: string, type: 'thread' | 'email' = 'thread') => {
      confirm(`Are you sure you want to delete this ${type}?`).then((confirmed) => {
        if (!confirmed) {
          toast.error(`Cancelled deleting ${type}.`);
        } else {
          return toast.promise(mutate(id), {
            loading: t('common.actions.deletingMail'),
            success: t('common.actions.deletedMail'),
            error: (error) => {
              console.error(`Error deleting ${type}:`, error);

              return t('common.actions.failedToDeleteMail');
            },
          });
        }
      });
    },
    isLoading,
  };
};

export default useDelete;
