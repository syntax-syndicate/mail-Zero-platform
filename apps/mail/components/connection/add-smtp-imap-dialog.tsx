import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InfoIcon, Loader2, Mail, CheckCircle, XCircle } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTRPC } from '@/providers/query-provider';
import { useMutation } from '@tanstack/react-query';
import { authClient } from '@/lib/auth-client';
import { useForm } from 'react-hook-form';
import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { z } from 'zod';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ConnectionMethod = 'manual' | 'oauth';

type OAuthProviderId =
  | 'google'
  | 'microsoft'
  | 'github'
  | 'apple'
  | 'discord'
  | 'facebook'
  | 'spotify'
  | 'twitch'
  | 'twitter'
  | 'dropbox'
  | 'kick'
  | 'linkedin'
  | 'gitlab'
  | 'tiktok'
  | 'reddit'
  | 'roblox'
  | 'vk'
  | 'zoom';

type ConnectionSecurityType = 'none' | 'ssl' | 'tls';

type EmailProvider = {
  id: string;
  name: string;
  icon: React.ReactNode;
  oauthSupported: boolean;
  oauthProviderId?: OAuthProviderId;
  defaultConfig?: {
    imapHost: string;
    imapPort: string;
    imapSecurityType: ConnectionSecurityType;
    smtpHost: string;
    smtpPort: string;
    smtpSecurityType: ConnectionSecurityType;
  };
};

const COMMON_EMAIL_PROVIDERS: EmailProvider[] = [
  {
    id: 'gmail',
    oauthProviderId: 'google' as OAuthProviderId,
    name: 'Gmail',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6">
        <path
          fill="currentColor"
          d="M11.99 13.9v-3.72h9.36c.14.63.25 1.22.25 2.05c0 5.71-3.83 9.77-9.6 9.77c-5.52 0-10-4.48-10-10S6.48 2 12 2c2.7 0 4.96.99 6.69 2.61l-2.84 2.76c-.72-.68-1.98-1.48-3.85-1.48c-3.31 0-6.01 2.75-6.01 6.12s2.7 6.12 6.01 6.12c3.83 0 5.24-2.65 5.5-4.22h-5.51z"
        />
      </svg>
    ),
    oauthSupported: true,
    defaultConfig: {
      imapHost: 'imap.gmail.com',
      imapPort: '993',
      imapSecurityType: 'ssl',
      smtpHost: 'smtp.gmail.com',
      smtpPort: '465',
      smtpSecurityType: 'ssl',
    },
  },
  {
    id: 'outlook',
    oauthProviderId: 'microsoft' as OAuthProviderId,
    name: 'Outlook',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
        <path d="M0 32h214.6v214.6H0V32zm233.4 0H448v214.6H233.4V32zM0 265.4h214.6V480H0V265.4zm233.4 0H448V480H233.4V265.4z" />
      </svg>
    ),
    oauthSupported: true,
    defaultConfig: {
      imapHost: 'outlook.office365.com',
      imapPort: '993',
      imapSecurityType: 'ssl',
      smtpHost: 'smtp.office365.com',
      smtpPort: '587',
      smtpSecurityType: 'tls',
    },
  },
  {
    id: 'yahoo',
    name: 'Yahoo',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
        <path d="M223.7 141.1 167 284.2 111 141.1H14.9L120.8 390.2 82.2 480h94.2L317.3 141.1zm105.4 135.8a58.2 58.2 0 1 0 58.2 58.2A58.2 58.2 0 0 0 329.1 276.9zM394.7 32l-93 223.5H406.4L499.1 32z" />
      </svg>
    ),
    oauthSupported: false,
    defaultConfig: {
      imapHost: 'imap.mail.yahoo.com',
      imapPort: '993',
      imapSecurityType: 'ssl',
      smtpHost: 'smtp.mail.yahoo.com',
      smtpPort: '465',
      smtpSecurityType: 'ssl',
    },
  },
  {
    id: 'custom',
    name: 'Other',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
        <path d="M64 208.1L256 65.9 448 208.1l0 47.4L289.5 373c-9.7 7.2-21.4 11-33.5 11s-23.8-3.9-33.5-11L64 255.5l0-47.4zM256 0c-12.1 0-23.8 3.9-33.5 11L25.9 156.7C9.6 168.8 0 187.8 0 208.1L0 448c0 35.3 28.7 64 64 64l384 0c35.3 0 64-28.7 64-64l0-239.9c0-20.3-9.6-39.4-25.9-51.4L289.5 11C279.8 3.9 268.1 0 256 0z" />
      </svg>
    ),
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
  imapSecurityType: z.enum(['none', 'ssl', 'tls', 'starttls']),
  smtpHost: z.string().min(1, 'SMTP host is required'),
  smtpPort: z.string().refine((val) => !isNaN(Number(val)), {
    message: 'Port must be a number',
  }),
  smtpSecurityType: z.enum(['none', 'ssl', 'tls', 'starttls']),
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
    trpc.connections.addImapSmtpConnection.mutationOptions(),
  );

  const { mutateAsync: testConnection } = useMutation(
    trpc.connections.testConnection.mutationOptions(),
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
      email: 'juana56@ethereal.email',
      refreshToken: 'uWUBeQZZRpRTxjAEMD',
      imapHost: 'imap.ethereal.email',
      imapPort: '993',
      imapSecurityType: 'TLS',
      smtpHost: '95.216.108.161',
      smtpPort: '587',
      smtpSecurityType: 'STARTTLS',
    },
  });

  const handleProviderSelect = (provider: EmailProvider) => {
    setSelectedProvider(provider);

    if (provider.oauthSupported) {
      setConnectionMethod('oauth');
    } else {
      setConnectionMethod('manual');
    }

    if (provider.defaultConfig) {
      form.setValue('imapHost', provider.defaultConfig.imapHost);
      form.setValue('imapPort', provider.defaultConfig.imapPort);
      form.setValue('imapSecurityType', provider.defaultConfig.imapSecurityType);
      form.setValue('smtpHost', provider.defaultConfig.smtpHost);
      form.setValue('smtpPort', provider.defaultConfig.smtpPort);
      form.setValue('smtpSecurityType', provider.defaultConfig.smtpSecurityType);
    }
  };

  const handleOAuthConnect = async () => {
    if (!selectedProvider || !selectedProvider.oauthSupported || !selectedProvider.oauthProviderId)
      return;

    try {
      setIsSubmitting(true);

      await authClient.linkSocial({
        provider: selectedProvider.oauthProviderId,
        callbackURL: `${process.env.NEXT_PUBLIC_APP_URL}/${pathname}?provider=${selectedProvider.id}`,
        scopes:
          selectedProvider.id === 'gmail'
            ? ['https://mail.google.com/']
            : ['Mail.ReadWrite', 'Mail.Send', 'offline_access'],
      });
    } catch (error) {
      console.error('Error initiating OAuth flow:', error);
      toast.error('Failed to connect with OAuth. Please try again or use manual setup.');
      setIsSubmitting(false);
    }
  };

  const handleTestConnection = async (data: FormValues) => {
    setIsTestingConnection(true);
    setTestResults(null);

    try {
      const imapSecure = data.imapSecurityType !== 'none';
      const smtpSecure = data.smtpSecurityType !== 'none';
      const imapTLS = data.imapSecurityType === 'tls';
      const smtpTLS = data.smtpSecurityType === 'tls';

      const results = await testConnection({
        email: data.email,
        password: data.refreshToken,
        imapHost: data.imapHost,
        imapPort: data.imapPort,
        imapSecure,
        imapTLS,
        smtpHost: data.smtpHost,
        smtpPort: data.smtpPort,
        smtpSecure,
        smtpTLS,
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

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      const imapSecure = data.imapSecurityType !== 'none';
      const smtpSecure = data.smtpSecurityType !== 'none';
      const imapTLS = data.imapSecurityType === 'tls';
      const smtpTLS = data.smtpSecurityType === 'tls';

      await addImapSmtpConnection({
        provider: 'imapAndSmtp' as any,
        auth: {
          email: data.email,
          refreshToken: data.refreshToken,
          host: data.imapHost,
          port: data.imapPort,
          secure: imapSecure,
          tls: imapTLS,
          smtpHost: data.smtpHost,
          smtpPort: data.smtpPort,
          smtpSecure,
          smtpTLS,
        },
      });

      toast.success('Your email account has been connected to Zero.');
      onOpenChange(false);

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

        <div className="mb-6">
          <h3 className="mb-3 text-sm font-medium">Select Email Provider</h3>
          <div className="grid grid-cols-4 gap-3">
            {COMMON_EMAIL_PROVIDERS.map((provider) => (
              <Button
                key={provider.id}
                type="button"
                variant={selectedProvider?.id === provider.id ? 'default' : 'outline'}
                className="group flex h-20 flex-col items-center justify-center gap-2 p-2"
                onClick={() => handleProviderSelect(provider)}
              >
                <span
                  className={cn(selectedProvider?.id === provider.id ? 'fill-black' : 'fill-white')}
                >
                  {provider.icon}
                </span>
                <span className="text-xs">{provider.name}</span>
              </Button>
            ))}
          </div>
        </div>

        {selectedProvider && (
          <>
            {selectedProvider.oauthSupported && (
              <div className="mb-6">
                <h3 className="mb-3 text-sm font-medium">Connection Method</h3>
                <Tabs
                  value={connectionMethod}
                  onValueChange={(v) => setConnectionMethod(v as ConnectionMethod)}
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="oauth">OAuth (Recommended)</TabsTrigger>
                    <TabsTrigger value="manual">Manual Setup</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}

            {connectionMethod === 'oauth' && selectedProvider.oauthSupported && (
              <div className="space-y-6">
                <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                  <h3 className="mb-2 text-sm font-medium">Benefits of OAuth</h3>
                  <ul className="text-muted-foreground ml-5 list-disc text-sm">
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

            {connectionMethod === 'manual' && (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="your.email@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="refreshToken"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Password
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <InfoIcon className="text-muted-foreground ml-2 h-4 w-4" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>This is your email account password or app password</p>
                            </TooltipContent>
                          </Tooltip>
                        </FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormDescription>
                          For Gmail or other services with 2FA, use an app password.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Tabs defaultValue="imap" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="imap">IMAP Settings</TabsTrigger>
                      <TabsTrigger value="smtp">SMTP Settings</TabsTrigger>
                    </TabsList>

                    <TabsContent value="imap" className="space-y-4 pt-4">
                      <FormField
                        control={form.control}
                        name="imapHost"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>IMAP Host</FormLabel>
                            <FormControl>
                              <Input placeholder="imap.example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="imapPort"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>IMAP Port</FormLabel>
                              <FormControl>
                                <Input placeholder="993" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="imapSecurityType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Connection Security</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select security type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  <SelectItem value="ssl">SSL</SelectItem>
                                  <SelectItem value="tls">TLS</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                {field.value === 'ssl'
                                  ? 'SSL encryption (usually port 993)'
                                  : field.value === 'tls'
                                    ? 'TLS encryption (usually port 143)'
                                    : 'No encryption (not recommended)'}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="smtp" className="space-y-4 pt-4">
                      <FormField
                        control={form.control}
                        name="smtpHost"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SMTP Host</FormLabel>
                            <FormControl>
                              <Input placeholder="smtp.example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="smtpPort"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>SMTP Port</FormLabel>
                              <FormControl>
                                <Input placeholder="465" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="smtpSecurityType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Connection Security</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select security type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  <SelectItem value="ssl">SSL</SelectItem>
                                  <SelectItem value="tls">TLS</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                {field.value === 'ssl'
                                  ? 'SSL encryption (usually port 465)'
                                  : field.value === 'tls'
                                    ? 'TLS encryption (usually port 587)'
                                    : 'No encryption (not recommended)'}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </TabsContent>
                  </Tabs>

                  {testResults && (
                    <div className="mt-4 rounded-md border border-gray-200 p-3 dark:border-gray-800">
                      <h4 className="mb-2 text-sm font-medium">Connection Test Results</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-1">
                          {testResults.imapTest?.success ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span>
                            IMAP:{' '}
                            {testResults.imapTest?.success
                              ? 'Connected'
                              : testResults.imapTest?.error || 'Failed'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {testResults.smtpTest?.success ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span>
                            SMTP:{' '}
                            {testResults.smtpTest?.success
                              ? 'Connected'
                              : testResults.smtpTest?.error || 'Failed'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleTestConnection(form.getValues())}
                      disabled={isTestingConnection || isSubmitting}
                    >
                      {isTestingConnection && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Test Connection
                    </Button>
                    <Button type="submit" disabled={isSubmitting || isTestingConnection}>
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Connect Email
                    </Button>
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
