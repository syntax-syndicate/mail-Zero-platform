import {
  PersistQueryClientProvider,
  type PersistedClient,
  type Persister,
} from '@tanstack/react-query-persist-client';
import { createTRPCClient, httpBatchLink, loggerLink } from '@trpc/client';
import { QueryCache, QueryClient, hashKey } from '@tanstack/react-query';
import { useSession, type Session, signOut } from '@/lib/auth-client';
import { createTRPCContext } from '@trpc/tanstack-react-query';
import type { AppRouter } from '@zero/server/trpc';
import { CACHE_BURST_KEY } from '@/lib/constants';
import type { PropsWithChildren } from 'react';
import { get, set, del } from 'idb-keyval';
import superjson from 'superjson';
import { toast } from 'sonner';

function createIDBPersister(idbValidKey: IDBValidKey = 'zero-query-cache') {
  return {
    persistClient: async (client: PersistedClient) => {
      await set(idbValidKey, client);
    },
    restoreClient: async () => {
      return await get<PersistedClient>(idbValidKey);
    },
    removeClient: async () => {
      await del(idbValidKey);
    },
  } satisfies Persister;
}

export const makeQueryClient = (session: Session | null) =>
  new QueryClient({
    queryCache: new QueryCache({
      onError: (err, { meta }) => {
        if (meta && meta.noGlobalError === true) return;
        if (meta && typeof meta.customError === 'string') toast.error(meta.customError);
        else if (err.message === 'Required scopes missing') {
          signOut({
            fetchOptions: {
              onSuccess: () => {
                if (window.location.href.includes('/login')) return;
                window.location.href = '/login?error=required_scopes_missing';
              },
            },
          });
        } else toast.error(err.message || 'Something went wrong');
      },
    }),
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        queryKeyHashFn: (queryKey) =>
          hashKey([
            session
              ? { userId: session.user.id, connectionId: session.connectionId }
              : { userId: null, connectionId: null },
            ...queryKey,
          ]),
        gcTime: 1000 * 60 * 60 * 24,
      },
      mutations: {
        onError: (err) => toast.error(err.message),
      },
    },
  });

let browserQueryClient = {
  queryClient: undefined,
  session: null,
} as {
  queryClient: QueryClient | undefined;
  session: Session | null;
};

const getQueryClient = (session: Session | null) => {
  if (typeof window === 'undefined') {
    return makeQueryClient(session);
  } else {
    if (
      !browserQueryClient.queryClient ||
      !browserQueryClient.session ||
      browserQueryClient.session.user.id !== session?.user.id ||
      browserQueryClient.session.connectionId !== session?.connectionId
    ) {
      browserQueryClient.queryClient = makeQueryClient(session);
      browserQueryClient.session = session;
    }
    return browserQueryClient.queryClient;
  }
};

const getUrl = () => {
  return import.meta.env.VITE_PUBLIC_BACKEND_URL + '/api/trpc';
};

export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    loggerLink({ enabled: () => true }),
    httpBatchLink({
      transformer: superjson,
      url: getUrl(),
      methodOverride: 'POST',
      fetch: (url, options) =>
        fetch(url, { ...options, credentials: 'include' }).then((res) => {
          const currentPath = new URL(window.location.href).pathname;
          const redirectPath = res.headers.get('X-Zero-Redirect');

          if (!!redirectPath && redirectPath !== currentPath) {
            window.location.href = redirectPath;
          }

          return res;
        }),
    }),
  ],
});

export function QueryProvider({ children }: PropsWithChildren) {
  const { data } = useSession();
  const queryClient = getQueryClient(data ?? null);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: createIDBPersister(),
        buster: CACHE_BURST_KEY,
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
      }}
    >
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </PersistQueryClientProvider>
  );
}
