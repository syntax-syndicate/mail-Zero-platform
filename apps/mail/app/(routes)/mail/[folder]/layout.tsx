import { Skeleton } from '@/components/ui/skeleton';
import { MailLayout } from '@/components/mail/mail';
import { Suspense } from 'react';

export default async function MainMailLayout({ children }: { children: React.ReactNode }) {
  return (
    <MailLayout>
      <div className="flex h-[calc(100vh-4rem)]">
        <div className="w-full">
          {/* <Suspense
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
          > */}
          {children}
          {/* </Suspense> */}
        </div>
      </div>
    </MailLayout>
  );
}
