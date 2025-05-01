import { useMail } from '@/components/mail/use-mail';
import { bulkDeleteThread } from '@/actions/mail';
import { useThreads } from '@/hooks/use-threads';
import { useStats } from '@/hooks/use-stats';
import { useState } from 'react';
import { toast } from 'sonner';

const useBulkDelete = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [_mail, setMail] = useMail();
  const { mutate: refetchThreads } = useThreads();
  const { mutate: refetchStats } = useStats();

  const onSuccess = async () => {
    await Promise.all([refetchThreads(), refetchStats()]);
    setMail((prev) => {
      return {
        ...prev,
        bulkSelected: [],
      };
    });
  };

  const mutate = async (ids: string[]) => {
    setIsLoading(true);
    await bulkDeleteThread({
      ids,
    });
    await onSuccess();
    setIsLoading(false);
  };

  return {
    mutate: (ids: string[]) => {
      toast.promise(mutate(ids), {
        loading: 'Moving to bin...',
        success: 'All done! moved to bin',
        error: 'Something went wrong!',
      });
    },
    isLoading,
  };
};

export default useBulkDelete;
