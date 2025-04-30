'use client';

import { ConfirmDialogProvider } from '@/components/context/confirmation-dialog-context';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { AISidebarProvider } from '@/components/ui/ai-sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { PostHogProvider } from './posthog-provider';
import { Provider as JotaiProvider } from 'jotai';
import { useSettings } from '@/hooks/use-settings';

export function Providers({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  const { settings } = useSettings();

  console.log(settings);

  const theme = settings?.colorTheme || 'system';

  return (
    // <AISidebarProvider>
    <JotaiProvider>
      <NuqsAdapter>
        <NextThemesProvider {...props} defaultTheme={theme}>
          <SidebarProvider>
            <PostHogProvider>
              <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
            </PostHogProvider>
          </SidebarProvider>
        </NextThemesProvider>
      </NuqsAdapter>
    </JotaiProvider>
    // </AISidebarProvider>
  );
}
