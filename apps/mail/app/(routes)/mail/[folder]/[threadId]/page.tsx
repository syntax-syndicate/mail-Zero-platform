import { SRThreadDisplay } from '@/components/mail/thread-display';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MailList } from '@/components/mail/mail-list';
import { Skeleton } from '@/components/ui/skeleton';
import { getMail, getMails } from '@/actions/mail';
import { InitialThread } from '@/types';
import { cn } from '@/lib/utils';
import { Suspense } from 'react';

interface MailPageProps {
  params: Promise<{
    threadId: string;
    folder: string;
  }>;
}

const SRMailList = async ({ folder }: { folder: string }) => {
  const items = await getMails({ folder, q: undefined, max: 20, pageToken: '' });
  return <MailList items={items?.threads ?? []} />;
};

export default async function MailPage({ params }: MailPageProps) {
  const { threadId, folder } = await params;
  const threadMessages = await getMail({ id: threadId });

  return (
    <div className="flex gap-4">
      <div className="w-[20%]">
        <Suspense
          fallback={[...Array(8)].map((_, i) => (
            <div key={i} className="flex flex-col px-4 py-3">
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="mt-2 h-3 w-32" />
              <Skeleton className="mt-2 h-3 w-full" />
              <div className="mt-2 flex gap-2">
                <Skeleton className="h-4 w-16 rounded-md" />
                <Skeleton className="h-4 w-16 rounded-md" />
              </div>
            </div>
          ))}
        >
          <SRMailList folder={folder} />
        </Suspense>
      </div>
      <div className="w-[80%]">
        <Suspense fallback={<p>Loading</p>}>
          <SRThreadDisplay messages={threadMessages ?? []} />
        </Suspense>
      </div>
    </div>
  );
}
