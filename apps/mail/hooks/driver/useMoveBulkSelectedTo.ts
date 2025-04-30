import useMoveThreadsTo, { type ThreadLocation } from '@/hooks/driver/use-move-threads-to';
import { useMail } from '@/components/mail/use-mail';
import { useCallback } from 'react';

const useMoveBulkSelectedTo = () => {
  const [mail, setMail] = useMail();
  const { mutateAsync: moveThreadTo, isLoading } = useMoveThreadsTo();

  const mutate = useCallback(async (source: string, destination: ThreadLocation) => {
    await moveThreadTo(mail.bulkSelected, source, destination);
  }, []);

  return {
    mutate: (destination: string) => {
      setMail({ ...mail, bulkSelected: [] });
    },
  };
};
