import { IGetThreads, MailPageProps, ParsedMessage } from '@/types';
import { SRThreadDisplay } from '@/components/mail/thread-display';
import { getMail, getMails, markAsRead } from '@/actions/mail';
import { Skeleton } from '@/components/ui/skeleton';
import { MailLayout } from '@/components/mail/mail';
import { redirect } from 'next/navigation';
import { SRMailList } from './list.server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Suspense } from 'react';

const ALLOWED_FOLDERS = ['inbox', 'draft', 'sent', 'spam', 'trash', 'archive'];

export default async function MailPage({ params, searchParams }: MailPageProps) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session) redirect('/login');

  const { folder } = await params;
  const { pageToken, q, max, labelIds, threadId } = await searchParams;

  let threadMessages: ParsedMessage[] = [];
  if (threadId) threadMessages = (await getMail({ id: threadId })) ?? [];
  if (threadMessages && threadMessages.some((e) => e.unread)) void markAsRead({ ids: [threadId] });
  const threadsResponse = await getMails({
    folder,
    q,
    max,
    pageToken,
    labelIds,
  });

  if (!ALLOWED_FOLDERS.includes(folder)) {
    return <div>Invalid folder</div>;
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <div className={cn(threadId ? 'md:w-[33%]' : 'w-full')}>
        <SRMailList
          resultSizeEstimate={threadsResponse?.resultSizeEstimate}
          threads={threadsResponse?.threads}
          nextPageToken={threadsResponse?.nextPageToken}
        />
      </div>
      {threadId ? (
        <div className="hidden border-l md:block md:w-[67%]">
          <Suspense fallback={<p>Loading</p>}>
            <SRThreadDisplay messages={threadMessages ?? []} />
          </Suspense>
        </div>
      ) : null}
    </div>
  );
}
