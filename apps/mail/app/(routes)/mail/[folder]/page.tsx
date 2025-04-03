import { IGetThreads, MailPageProps } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { MailLayout } from '@/components/mail/mail';
import { redirect } from 'next/navigation';
import { SRMailList } from './list.server';
import { getMails } from '@/actions/mail';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { Suspense } from 'react';

const ALLOWED_FOLDERS = ['inbox', 'draft', 'sent', 'spam', 'trash', 'archive'];

export default async function MailPage({ params, searchParams }: MailPageProps) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session) redirect('/login');

  const { threadId, folder } = await params;
  const { pageToken, q, max, labelIds } = await searchParams;
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
    <SRMailList
      threads={threadsResponse?.threads}
      nextPageToken={threadsResponse?.nextPageToken}
      resultSizeEstimate={threadsResponse?.resultSizeEstimate}
    />
  );
}
