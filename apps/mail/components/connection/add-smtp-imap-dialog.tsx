import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { z } from 'zod';
import React, { useState } from 'react';
import { InfoIcon, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

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

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      // Submit data to the server
      // This would typically be an API call to your backend
      const response = await fetch('/api/email/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: 'imap-smtp',
          auth: {
            email: data.email,
            refreshToken: data.refreshToken,
            host: data.imapHost,
            port: data.imapPort,
            secure: data.imapSecure,
            smtpHost: data.smtpHost,
            smtpPort: data.smtpPort,
            smtpSecure: data.smtpSecure,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to connect email account');
      }

      toast.success('Your email account has been connected to Zero.');

      onOpenChange(false);
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
          <DialogTitle>Add SMTP/IMAP</DialogTitle>
          <DialogDescription>Add your SMTP/IMAP settings to connect your email.</DialogDescription>
        </DialogHeader>

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
                        <InfoIcon className="ml-2 h-4 w-4 text-muted-foreground" />
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
                    name="imapSecure"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Secure Connection (SSL/TLS)</FormLabel>
                        <FormControl>
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              id="imap-secure"
                            />
                            <label htmlFor="imap-secure">
                              {field.value ? 'Enabled' : 'Disabled'}
                            </label>
                          </div>
                        </FormControl>
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
                    name="smtpSecure"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Secure Connection (SSL/TLS)</FormLabel>
                        <FormControl>
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              id="smtp-secure"
                            />
                            <label htmlFor="smtp-secure">
                              {field.value ? 'Enabled' : 'Disabled'}
                            </label>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end pt-4">
              <Button type="button" variant="outline" className="mr-2" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Connect Email
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default AddSmtpImapDialog;
