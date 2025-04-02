import { SRThreadDisplay } from '@/components/mail/thread-display';
import { getMail, getMails, markAsRead } from '@/actions/mail';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MailList } from '@/components/mail/mail-list';
import { Skeleton } from '@/components/ui/skeleton';
import { MailLayout } from '@/components/mail/mail';
import { SRMailList } from '../list.server';
import { MailPageProps } from '@/types';
import { Suspense } from 'react';

export default async function MailPage({ params, searchParams }: MailPageProps) {
  const { threadId, folder } = await params;
  const { pageToken, q, max } = await searchParams;
  const threadMessages = await getMail({ id: threadId });
  if (threadMessages && threadMessages.some((e) => e.unread)) void markAsRead({ ids: [threadId] });

  return (
    <MailLayout>
      <div className="flex h-[calc(100vh-4rem)]">
        <div className="w-full md:w-[33%]">
          <Suspense
            fallback={
              <div className="flex flex-col">
                {[...Array(8)].map((_, i) => (
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
              </div>
            }
          >
            <SRMailList pageToken={pageToken} max={max} q={q} folder={folder} />
          </Suspense>
        </div>
        <div className="hidden md:block md:w-[67%] border-l">
          <Suspense fallback={<p>Loading</p>}>
            <SRThreadDisplay messages={threadMessages ?? []} />
          </Suspense>
        </div>
      </div>
    </MailLayout>
  );
}
