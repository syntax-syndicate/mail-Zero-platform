import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
} from '@/components/ui/sidebar';
import { SquarePenIcon, type SquarePenIconHandle } from '../icons/animated/square-pen';
import { navigationConfig, bottomNavItems } from '@/config/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { useSidebar } from '@/components/ui/sidebar';
import { CreateEmail } from '../create/create-email';
import { PencilCompose, X } from '../icons/icons';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSession } from '@/lib/auth-client';
import React, { useMemo, useRef } from 'react';
import { useStats } from '@/hooks/use-stats';
import { useLocation } from 'react-router';
import { useTranslations } from 'use-intl';
import { FOLDERS } from '@/lib/utils';
import { NavMain } from './nav-main';
import { NavUser } from './nav-user';
import { useQueryState } from 'nuqs';

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: stats } = useStats();

  const location = useLocation();
  const { data: session } = useSession();
  const { currentSection, navItems } = useMemo(() => {
    // Find which section we're in based on the pathname
    const section = Object.entries(navigationConfig).find(([, config]) =>
      location.pathname.startsWith(config.path),
    );

    const currentSection = section?.[0] || 'mail';
    if (navigationConfig[currentSection]) {
      const items = [...navigationConfig[currentSection].sections];

      if (currentSection === 'mail' && stats && stats.length) {
        if (items[0]?.items[0]) {
          items[0].items[0].badge =
            stats.find((stat) => stat.label?.toLowerCase() === FOLDERS.INBOX)?.count ?? 0;
        }
        if (items[0]?.items[3]) {
          items[0].items[3].badge =
            stats.find((stat) => stat.label?.toLowerCase() === FOLDERS.SENT)?.count ?? 0;
        }
      }

      return { currentSection, navItems: items };
    } else {
      return {
        currentSection: '',
        navItems: [],
      };
    }
  }, [location.pathname, stats]);

  const showComposeButton = currentSection === 'mail';
  const { state } = useSidebar();

  return (
    <div>
      <Sidebar
        collapsible="icon"
        {...props}
        className={`top-2.5 flex h-screen select-none flex-col items-center ${state === 'collapsed' ? '' : ''} pb-2`}
      >
        <div
          className={`relative z-20 flex w-full flex-col ${state === 'collapsed' ? 'px-0' : 'md:px-2'}`}
        >
          <SidebarHeader className="flex flex-col">
            {session && <NavUser />}
            <AnimatePresence mode="wait">
              {showComposeButton && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                >
                  <ComposeButton />
                </motion.div>
              )}
            </AnimatePresence>
          </SidebarHeader>
          <SidebarContent className={`py-0 pt-0 ${state !== 'collapsed' ? 'mt-5' : ''}`}>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSection}
                initial={{ opacity: 0, x: currentSection === 'mail' ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: currentSection === 'mail' ? 20 : -20 }}
                transition={{ duration: 0.2 }}
                className="flex-1 py-0"
              >
                <NavMain items={navItems} />
              </motion.div>
            </AnimatePresence>
          </SidebarContent>
        </div>

        <div
          className={`mt-auto flex w-full flex-col ${state !== 'collapsed' ? 'px-0 md:px-2' : ''}`}
        >
          <SidebarContent className="py-0 pt-0">
            <NavMain items={bottomNavItems} />
          </SidebarContent>
        </div>
      </Sidebar>
    </div>
  );
}

function ComposeButton() {
  const { state } = useSidebar();
  const isMobile = useIsMobile();
  const t = useTranslations();

  const [dialogOpen, setDialogOpen] = useQueryState('isComposeOpen');
  const [, setDraftId] = useQueryState('draftId');
  const [, setTo] = useQueryState('to');
  const [, setActiveReplyId] = useQueryState('activeReplyId');
  const [, setMode] = useQueryState('mode');

  const handleOpenChange = async (open: boolean) => {
    if (!open) {
      // Clear all query params at once for faster closing
      await Promise.all([
        setDialogOpen(null),
        setDraftId(null),
        setTo(null),
        setActiveReplyId(null),
        setMode(null),
      ]);
    } else {
      setDialogOpen('true');
    }
  };
  return (
    <Dialog open={!!dialogOpen} onOpenChange={handleOpenChange}>
      <DialogTitle></DialogTitle>
      <DialogDescription></DialogDescription>

      <DialogTrigger asChild>
        <button className="inline-flex h-8 w-full items-center justify-center gap-1 self-stretch overflow-hidden rounded-md border border-gray-200 bg-transparent text-black dark:border-none dark:bg-gradient-to-b dark:from-white/20 dark:to-white/10 dark:text-white dark:outline dark:outline-1 dark:outline-offset-[-1px] dark:outline-white/5">
          {state === 'collapsed' && !isMobile ? (
            <PencilCompose className="fill-iconLight dark:fill-iconDark mt-0.5 text-black" />
          ) : (
            <div className="flex items-center justify-center gap-2.5 pl-0.5 pr-1">
              <PencilCompose className="fill-iconLight dark:fill-iconDark" />
              <div className="justify-start text-sm leading-none">
                {t('common.commandPalette.commands.newEmail')}
              </div>
            </div>
          )}
        </button>
      </DialogTrigger>

      <DialogContent className="h-screen w-screen max-w-none border-none bg-[#FAFAFA] p-0 shadow-none dark:bg-[#141414]">
        <CreateEmail />
      </DialogContent>
    </Dialog>
  );
}
