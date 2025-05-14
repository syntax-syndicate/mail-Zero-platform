import { AISidebarProvider } from '@/components/ui/ai-sidebar';
import { NuqsAdapter } from 'nuqs/adapters/react-router/v7';
import { SidebarProvider } from '@/components/ui/sidebar';
import { PostHogProvider } from '@/lib/posthog-provider';
import { useSettings } from '@/hooks/use-settings';
import CustomToaster from '@/components/ui/toast';
import { Provider as JotaiProvider } from 'jotai';
import type { PropsWithChildren } from 'react';
import { ThemeProvider } from 'next-themes';

export function ClientProviders({ children }: PropsWithChildren) {
  const { data } = useSettings();

  const theme = data?.settings.colorTheme || 'system';

  return (
    <NuqsAdapter>
      <AISidebarProvider>
        <JotaiProvider>
          <ThemeProvider
            attribute="class"
            enableSystem
            disableTransitionOnChange
            defaultTheme={theme}
          >
            <SidebarProvider>
              <PostHogProvider>
                {children}
                <CustomToaster />
              </PostHogProvider>
            </SidebarProvider>
          </ThemeProvider>
        </JotaiProvider>
      </AISidebarProvider>
    </NuqsAdapter>
  );
}
