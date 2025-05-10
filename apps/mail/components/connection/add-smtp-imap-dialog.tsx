import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { zodResolver } from '@hookform/resolvers/zod';
import { authClient } from '@/lib/auth-client';
import { useTRPC } from '@/providers/query-provider';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { z } from 'zod';
import React, { useState } from 'react';
import { AlertCircle, Check, InfoIcon, Loader2, Mail, X } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { usePathname, useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ConnectionMethod = 'manual' | 'oauth';

// Map our internal provider IDs to better-auth compatible provider IDs
type OAuthProviderId = 'google' | 'microsoft' | 'github' | 'apple' | 'discord' | 'facebook' | 
  'spotify' | 'twitch' | 'twitter' | 'dropbox' | 'kick' | 'linkedin' | 'gitlab' | 
  'tiktok' | 'reddit' | 'roblox' | 'vk' | 'zoom';

type EmailProvider = {
  id: string;
  name: string;
  icon: React.ReactNode;
  oauthSupported: boolean;
  oauthProviderId?: OAuthProviderId;
  defaultConfig?: {
    imapHost: string;
    imapPort: string;
    imapSecure: boolean;
    smtpHost: string;
    smtpPort: string;
    smtpSecure: boolean;
  };
};

const COMMON_EMAIL_PROVIDERS: EmailProvider[] = [
  {
    id: 'gmail',
    oauthProviderId: 'google' as OAuthProviderId,
    name: 'Gmail',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6">
        <path fill="currentColor" d="M11.99 13.9v-3.72h9.36c.14.63.25 1.22.25 2.05c0 5.71-3.83 9.77-9.6 9.77c-5.52 0-10-4.48-10-10S6.48 2 12 2c2.7 0 4.96.99 6.69 2.61l-2.84 2.76c-.72-.68-1.98-1.48-3.85-1.48c-3.31 0-6.01 2.75-6.01 6.12s2.7 6.12 6.01 6.12c3.83 0 5.24-2.65 5.5-4.22h-5.51z" />
      </svg>
    ),
    oauthSupported: true,
    defaultConfig: {
      imapHost: 'imap.gmail.com',
      imapPort: '993',
      imapSecure: true,
      smtpHost: 'smtp.gmail.com',
      smtpPort: '465',
      smtpSecure: true,
    },
  },
  {
    id: 'outlook',
    oauthProviderId: 'microsoft' as OAuthProviderId,
    name: 'Outlook',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6">
        <path
          fill="currentColor"
          d="M21.179 4.828L11.776 1.04a.504.504 0 0 0-.403 0L2 4.828V19.01l9.372 3.93a.504.504 0 0 0 .403 0L21.18 19.01V4.828h-.001ZM9.85 11.648H7.842V9.64h2.008v2.008Zm3.307 0H11.15V9.64h2.009v2.008Zm3.308 0h-2.008V9.64h2.008v2.008Zm0-3.307h-2.008V6.333h2.008V8.34Zm-3.308 0H11.15V6.333h2.009V8.34Zm-3.307 0H7.842V6.333h2.008V8.34Z"
        />
      </svg>
    ),
    oauthSupported: true,
    defaultConfig: {
      imapHost: 'outlook.office365.com',
      imapPort: '993',
      imapSecure: true,
      smtpHost: 'smtp.office365.com',
      smtpPort: '587',
      smtpSecure: false,
    },
  },
  {
    id: 'yahoo',
    name: 'Yahoo',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6">
        <path
          fill="currentColor"
          d="M13.258 12.942l.463 10.358h-3.442l.495-10.358Zm-.495-7.265c1.021 0 1.84.92 1.84 2.057 0 1.138-.819 2.058-1.84 2.058s-1.84-.92-1.84-2.058c0-1.137.819-2.057 1.84-2.057ZM20.77 3.5l-3.376 8.98c-.092.184-.063.372 0 .54l3.376 7.574C21.133 21.516 20 22 20 22H17.37l-2.155-5.277-2.215 5.277H8c0 0-1.133-.485-.798-1.406L10.548 13c.092-.153.094-.358 0-.54L7.23 3.5H10l2.155 5.277L14.37 3.5h3"
        />
      </svg>
    ),
    oauthSupported: false,
    defaultConfig: {
      imapHost: 'imap.mail.yahoo.com',
      imapPort: '993',
      imapSecure: true,
      smtpHost: 'smtp.mail.yahoo.com',
      smtpPort: '465',
      smtpSecure: true,
    },
  },
  {
    id: 'custom',
    name: 'Other',
    icon: <Mail className="h-6 w-6" />,
    oauthSupported: false,
  },
];

const formSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  refreshToken: z.string().min(1, 'Password is required'),
  imapHost: z.string().min(1, 'IMAP host is required'),
  imapPort: z.string().refine((val) => !isNaN(Number(val)), {
    message: 'Port must be a number',
  }),
  imapSecure: z.boolean().default(true),
  smtpHost: z.string().min(1, 'SMTP host is required'),
  smtpPort: z.string().refine((val) => !isNaN(Number(val)), {
    message: 'Port must be a number',
  }),
  smtpSecure: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

const AddSmtpImapDialog = ({ open, onOpenChange }: Props) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<EmailProvider | null>(null);
  const [connectionMethod, setConnectionMethod] = useState<ConnectionMethod>('manual');
  const pathname = usePathname();
  const router = useRouter();
  const trpc = useTRPC();
  const { mutateAsync: addImapSmtpConnection } = useMutation(
    trpc.connections.addImapSmtpConnection.mutationOptions()
  );
  
  const { mutateAsync: testConnection } = useMutation(
    trpc.connections.testConnection.mutationOptions()
  );
  
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResults, setTestResults] = useState<{
    success?: boolean;
    imapTest?: { success: boolean; error?: string };
    smtpTest?: { success: boolean; error?: string };
  } | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      refreshToken: '',
      imapHost: '',
      imapPort: '993',
      imapSecure: true,
      smtpHost: '',
      smtpPort: '465',
      smtpSecure: true,
    },
  });

  // Update form values when provider is selected
  const handleProviderSelect = (provider: EmailProvider) => {
    setSelectedProvider(provider);
    
    // If the provider has OAuth support, set connection method to OAuth
    if (provider.oauthSupported) {
      setConnectionMethod('oauth');
    } else {
      setConnectionMethod('manual');
    }
    
    // If provider has default config, update the form values
    if (provider.defaultConfig) {
      form.setValue('imapHost', provider.defaultConfig.imapHost);
      form.setValue('imapPort', provider.defaultConfig.imapPort);
      form.setValue('imapSecure', provider.defaultConfig.imapSecure);
      form.setValue('smtpHost', provider.defaultConfig.smtpHost);
      form.setValue('smtpPort', provider.defaultConfig.smtpPort);
      form.setValue('smtpSecure', provider.defaultConfig.smtpSecure);
    }
  };

  // Handle OAuth authentication
  const handleOAuthConnect = async () => {
    if (!selectedProvider || !selectedProvider.oauthSupported || !selectedProvider.oauthProviderId) return;
    
    try {
      setIsSubmitting(true);
      
      // Use better-auth to link the social account
      await authClient.linkSocial({
        provider: selectedProvider.oauthProviderId,
        callbackURL: `${process.env.NEXT_PUBLIC_APP_URL}/${pathname}?provider=${selectedProvider.id}`,
        // Add specific scopes for IMAP/SMTP access
        scopes: selectedProvider.id === 'gmail' ? 
          ['https://mail.google.com/'] : // Gmail specific scope for full mail access
          ['Mail.ReadWrite', 'Mail.Send', 'offline_access'], // Microsoft specific scopes
      });
      
      // Note: The actual connection will happen after OAuth redirect
      // We don't need to handle it here since the callback will manage it
    } catch (error) {
      console.error('Error initiating OAuth flow:', error);
      toast.error('Failed to connect with OAuth. Please try again or use manual setup.');
      setIsSubmitting(false);
    }
  };

  // Test the connection without saving
  const handleTestConnection = async (data: FormValues) => {
    setIsTestingConnection(true);
    setTestResults(null);
    
    try {
      // Test the connection using the tRPC endpoint
      const results = await testConnection({
        email: data.email,
        password: data.refreshToken, // Use the password field for testing
        imapHost: data.imapHost,
        imapPort: data.imapPort,
        imapSecure: data.imapSecure,
        smtpHost: data.smtpHost,
        smtpPort: data.smtpPort,
        smtpSecure: data.smtpSecure,
      });
      
      setTestResults(results);
      
      if (results.success) {
        toast.success('Connection test successful! Both IMAP and SMTP connections work.');
      } else {
        if (!results.imapTest?.success) {
          toast.error(`IMAP connection failed: ${results.imapTest?.error || 'Unknown error'}`);
        } else if (!results.smtpTest?.success) {
          toast.error(`SMTP connection failed: ${results.smtpTest?.error || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to test connection');
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Handle manual form submission
  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      // Submit data to the server using tRPC mutation
      await addImapSmtpConnection({
        provider: 'imapAndSmtp' as any, // Type assertion to match server schema
        auth: {
          email: data.email,
          refreshToken: data.refreshToken, // This is the password for manual setup
          host: data.imapHost,
          port: data.imapPort,
          secure: data.imapSecure,
          smtpHost: data.smtpHost,
          smtpPort: data.smtpPort,
          smtpSecure: data.smtpSecure,
        },
      });

      toast.success('Your email account has been connected to Zero.');
      onOpenChange(false);
      
      // Refresh the page to show the new connection
      router.refresh();
    } catch (error) {
      console.error('Error connecting email:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to connect email account');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showOverlay={true} className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Email Account</DialogTitle>
          <DialogDescription>Connect your email account to Zero.</DialogDescription>
        </DialogHeader>

        {/* Provider Selection */}
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-medium">Select Email Provider</h3>
          <div className="grid grid-cols-4 gap-3">
            {COMMON_EMAIL_PROVIDERS.map((provider) => (
              <Button
                key={provider.id}
                type="button"
                variant={selectedProvider?.id === provider.id ? 'default' : 'outline'}
                className="flex h-20 flex-col items-center justify-center gap-2 p-2"
                onClick={() => handleProviderSelect(provider)}
              >
                {provider.icon}
                <span className="text-xs">{provider.name}</span>
              </Button>
            ))}
          </div>
        </div>

        {selectedProvider && (
          <>
            {/* Connection Method Selection */}
            {selectedProvider.oauthSupported && (
              <div className="mb-6">
                <h3 className="mb-3 text-sm font-medium">Connection Method</h3>
                <Tabs value={connectionMethod} onValueChange={(v) => setConnectionMethod(v as ConnectionMethod)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="oauth">OAuth (Recommended)</TabsTrigger>
                    <TabsTrigger value="manual">Manual Setup</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}

            {/* OAuth Connection */}
            {connectionMethod === 'oauth' && selectedProvider.oauthSupported && (
              <div className="space-y-6">
                <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                  <h3 className="mb-2 text-sm font-medium">Benefits of OAuth</h3>
                  <ul className="ml-5 list-disc text-sm text-muted-foreground">
                    <li>More secure - no need to store passwords</li>
                    <li>Easier to set up - no manual configuration</li>
                    <li>Maintains compatibility with 2FA</li>
                  </ul>
                </div>
                
                <Button
                  type="button"
                  className="w-full"
                  onClick={handleOAuthConnect}
                  disabled={isSubmitting}
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Connect with {selectedProvider.name}
                </Button>
              </div>
            )}

            {/* Manual Connection Form */}
            {connectionMethod === 'manual' && (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      </div>
                      <div className="flex items-center gap-1">
                        <span>{testResults.smtpTest?.success ? '✅' : '❌'}</span>
                        <span>SMTP: {testResults.smtpTest?.success ? 'Connected' : testResults.smtpTest?.error || 'Failed'}</span>
                      </div>
                    </div>
                  </div>
                </form>
              </Form>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AddSmtpImapDialog;
