import { useEmailAliases } from '@/hooks/use-email-aliases';
import { EmailComposer } from '../create/email-composer';
import { useHotkeysContext } from 'react-hotkeys-hook';
import { useTRPC } from '@/providers/query-provider';
import { useMutation } from '@tanstack/react-query';
import { constructReplyBody } from '@/lib/utils';
import { useThread } from '@/hooks/use-threads';
import { useSession } from '@/lib/auth-client';
import { serializeFiles } from '@/lib/schemas';
import { useDraft } from '@/hooks/use-drafts';
import { useEffect, useState } from 'react';
import { useTranslations } from 'use-intl';
import type { Sender } from '@/types';
import { useQueryState } from 'nuqs';
import { toast } from 'sonner';

interface ReplyComposeProps {
  messageId?: string;
}

export default function ReplyCompose({ messageId }: ReplyComposeProps) {
  const [threadId] = useQueryState('threadId');
  const { data: emailData, refetch } = useThread(threadId);
  const { data: session } = useSession();
  const [mode, setMode] = useQueryState('mode');
  const { enableScope, disableScope } = useHotkeysContext();
  const { data: aliases, isLoading: isLoadingAliases } = useEmailAliases();
  const t = useTranslations();
  const [draftId, setDraftId] = useQueryState('draftId');
  const { data: draft, isLoading: isDraftLoading } = useDraft(draftId ?? null);
  const trpc = useTRPC();
  const { mutateAsync: sendEmail } = useMutation(trpc.mail.send.mutationOptions());

  // Find the specific message to reply to
  const replyToMessage =
    (messageId && emailData?.messages.find((msg) => msg.id === messageId)) || emailData?.latest;

  // Initialize recipients and subject when mode changes
  useEffect(() => {
    if (!replyToMessage || !mode || !session?.activeConnection?.email) return;

    const userEmail = session.activeConnection.email.toLowerCase();
    const senderEmail = replyToMessage.sender.email.toLowerCase();

    // Set subject based on mode
    const subject =
      mode === 'forward'
        ? `Fwd: ${replyToMessage.subject || ''}`
        : replyToMessage.subject?.startsWith('Re:')
          ? replyToMessage.subject
          : `Re: ${replyToMessage.subject || ''}`;

    if (mode === 'reply') {
      // Reply to sender
      const to: string[] = [];

      // If the sender is not the current user, add them to the recipients
      if (senderEmail !== userEmail) {
        to.push(replyToMessage.sender.email);
      } else if (replyToMessage.to && replyToMessage.to.length > 0 && replyToMessage.to[0]?.email) {
        // If we're replying to our own email, reply to the first recipient
        to.push(replyToMessage.to[0].email);
      }

      // Initialize email composer with these recipients
      // Note: The actual initialization happens in the EmailComposer component
    } else if (mode === 'replyAll') {
      const to: string[] = [];
      const cc: string[] = [];

      // Add original sender if not current user
      if (senderEmail !== userEmail) {
        to.push(replyToMessage.sender.email);
      }

      // Add original recipients from To field
      replyToMessage.to?.forEach((recipient) => {
        const recipientEmail = recipient.email.toLowerCase();
        if (recipientEmail !== userEmail && recipientEmail !== senderEmail) {
          to.push(recipient.email);
        }
      });

      // Add CC recipients
      replyToMessage.cc?.forEach((recipient) => {
        const recipientEmail = recipient.email.toLowerCase();
        if (recipientEmail !== userEmail && !to.includes(recipient.email)) {
          cc.push(recipient.email);
        }
      });

      // Initialize email composer with these recipients
    } else if (mode === 'forward') {
      // For forward, we start with empty recipients
      // Just set the subject and include the original message
    }
  }, [mode, replyToMessage, session?.activeConnection?.email]);

  const handleSendEmail = async (data: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    message: string;
    attachments: File[];
  }) => {
    if (!replyToMessage || !session?.activeConnection?.email) return;

    try {
      const userEmail = session.activeConnection.email.toLowerCase();

      // Convert email strings to Sender objects
      const toRecipients: Sender[] = data.to.map((email) => ({
        email,
        name: email.split('@')[0] || 'User',
      }));

      const ccRecipients: Sender[] | undefined = data.cc
        ? data.cc.map((email) => ({
            email,
            name: email.split('@')[0] || 'User',
          }))
        : undefined;

      const bccRecipients: Sender[] | undefined = data.bcc
        ? data.bcc.map((email) => ({
            email,
            name: email.split('@')[0] || 'User',
          }))
        : undefined;

      const replyBody = constructReplyBody(
        data.message,
        new Date(replyToMessage.receivedOn || '').toLocaleString(),
        replyToMessage.sender,
        toRecipients,
        replyToMessage.decodedBody,
      );

      await sendEmail({
        to: toRecipients,
        cc: ccRecipients,
        bcc: bccRecipients,
        subject: data.subject,
        message: replyBody,
        attachments: await serializeFiles(data.attachments),
        fromEmail: aliases?.[0]?.email || userEmail,
        headers: {
          'In-Reply-To': replyToMessage?.messageId ?? '',
          References: [
            ...(replyToMessage?.references ? replyToMessage.references.split(' ') : []),
            replyToMessage?.messageId,
          ]
            .filter(Boolean)
            .join(' '),
          'Thread-Id': replyToMessage?.threadId ?? '',
        },
        threadId: replyToMessage?.threadId,
      });

      // Reset states
      setMode(null);
      await refetch();
      toast.success(t('pages.createEmail.emailSent'));
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error(t('pages.createEmail.failedToSendEmail'));
    }
  };

  console.log('draftcontent', draft);

  useEffect(() => {
    if (mode) {
      enableScope('compose');
    } else {
      disableScope('compose');
    }
    return () => {
      disableScope('compose');
    };
  }, [mode, enableScope, disableScope]);

  // Add effect to handle initial focus
  const [shouldFocus, setShouldFocus] = useState(true);
  useEffect(() => {
    if (mode) {
      setShouldFocus(true);
    } else {
      setShouldFocus(false);
    }
  }, [mode]);

  if (!mode || !emailData) return null;

  if (draftId && isDraftLoading) {
    // wait for the draft if requesting one
    return null;
  }

  return (
    <div className="w-full rounded-xl bg-white dark:bg-[#141414]">
      <EmailComposer
        className="w-full !max-w-none border pb-1 dark:bg-[#141414]"
        onSendEmail={handleSendEmail}
        onClose={async () => {
          await setMode(null);
          await setDraftId(null);
        }}
        initialMessage={draft?.content}
        initialTo={draft?.to}
        initialSubject={draft?.subject}
        threadContent={emailData.messages.map((message) => {
          return {
            body: message.decodedBody ?? '',
            from: message.sender.name ?? message.sender.email,
            to: message.to.reduce<string[]>((to, recipient) => {
              if (recipient.name) {
                to.push(recipient.name);
              }
              return to;
            }, []),
            cc: message.cc?.reduce<string[]>((cc, recipient) => {
              if (recipient.name) {
                cc.push(recipient.name);
              }
              return cc;
            }, []),
            subject: message.subject,
          };
        })}
        autofocus={shouldFocus}
      />
    </div>
  );
}
