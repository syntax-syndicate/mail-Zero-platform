import { MailList } from '@/components/mail/mail-list';
import { defaultPageSize } from '@/lib/utils';
import { getMails } from '@/actions/mail';
import { IGetThreads } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';

export const SRMailList = async ({ folder, q, max = defaultPageSize, pageToken }: IGetThreads) => {
  const fetchThreads = await getMails({ folder, q, max, pageToken });
  return (
    <ScrollArea className="h-[calc(100vh-4rem)]">
      <MailList
        items={fetchThreads?.threads ?? []}
        size={fetchThreads?.resultSizeEstimate}
        next={fetchThreads?.nextPageToken}
      />
    </ScrollArea>
  );
};
