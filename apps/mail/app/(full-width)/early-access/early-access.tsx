'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';

// Define the type for early access users (exported for use in page.tsx)
export type EarlyAccessUser = {
  id: string;
  email: string;
  isEarlyAccess: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
};

// Client component for the confirmation dialog
function ConfirmationDialog({
  isOpen,
  onClose,
  selectedUsers,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  selectedUsers: EarlyAccessUser[];
  onConfirm: () => void;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Early Access Selection</DialogTitle>
          <DialogDescription>
            You are about to grant early access to {selectedUsers.length} users. Please review the
            list below.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[400px] overflow-auto rounded-md border p-2">
          {selectedUsers.map((user) => (
            <div key={user.id} className="border-b py-2 last:border-0">
              <p className="text-sm font-medium">{user.email}</p>
              <p className="text-muted-foreground text-xs">
                Signed up: {format(new Date(user.createdAt), 'MMM d, yyyy')}
              </p>
            </div>
          ))}
        </div>
        <DialogFooter className="flex justify-between sm:justify-between">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>Confirm Selection</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type UpdateEarlyAccessResult = {
  success: boolean;
  emails?: string[];
  error?: any;
};

type ResendApiResponse = {
  success: boolean;
  totalProcessed?: number;
  successfulCount?: number;
  failedCount?: number;
  successfulEmails?: string[];
  failedEmails?: string[];
  detailedResults?: Array<{ email: string; success: boolean; response?: any; error?: any }>;
  error?: any;
};

export function EarlyAccessClient({
  initialUsers,
  updateEarlyAccessUsers,
}: {
  initialUsers: EarlyAccessUser[];
  updateEarlyAccessUsers: (userIds: string[]) => Promise<UpdateEarlyAccessResult>;
}) {
  const [earlyAccessUsers, setEarlyAccessUsers] = useState<EarlyAccessUser[]>(initialUsers);
  const [selectedUsers, setSelectedUsers] = useState<EarlyAccessUser[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [customEmails, setCustomEmails] = useState('');

  const earlyAccessCount = earlyAccessUsers.filter((user) => user.isEarlyAccess).length;

  const selectRandomUsers = async () => {
    try {
      // First get the list of already emailed users
      const outputResponse = await fetch('/output.json');
      const { emails: alreadyEmailed } = await outputResponse.json();
      
      // Filter out users who have already been emailed
      const availableUsers = earlyAccessUsers.filter(user => !alreadyEmailed.includes(user.email));
      
      if (availableUsers.length === 0) {
        toast.error('All users have already been emailed');
        return;
      }

      // Randomly select from remaining users
      const shuffled = [...availableUsers].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 500); // Select 500 users for testing
      
      toast.success(`Selected ${selected.length} users who haven't been emailed yet`);
      setSelectedUsers(selected);
      setIsDialogOpen(true);
    } catch (error) {
      console.error('Error selecting users:', error);
      toast.error('Failed to check already emailed users');
    }
  };

  const handleCustomEmails = async () => {
    try {
      const emails = customEmails.split(',').map(email => email.trim());
      
      // Get the list of already emailed users
      const outputResponse = await fetch('/output.json');
      const { emails: alreadyEmailed } = await outputResponse.json();
      
      // Filter out users who have already been emailed
      const selectedUsers = earlyAccessUsers.filter(user => 
        emails.includes(user.email) && !alreadyEmailed.includes(user.email)
      );
      
      if (selectedUsers.length === 0) {
        toast.error('No valid emails found or all specified emails have already been sent');
        return;
      }

      if (selectedUsers.length !== emails.length) {
        const notFound = emails.filter(email => !earlyAccessUsers.some(user => user.email === email));
        const alreadySent = emails.filter(email => alreadyEmailed.includes(email));
        
        if (notFound.length > 0) {
          toast.warning(`Some emails were not found: ${notFound.join(', ')}`);
        }
        if (alreadySent.length > 0) {
          toast.warning(`Some emails were already sent to: ${alreadySent.join(', ')}`);
        }
      }

      setSelectedUsers(selectedUsers);
      setIsDialogOpen(true);
      setCustomEmails(''); // Clear the input after opening dialog
    } catch (error) {
      console.error('Error handling custom emails:', error);
      toast.error('Failed to check already emailed users');
    }
  };

  const handleConfirm = async () => {
    try {
      setIsUpdating(true);
      const selectedEmails = selectedUsers.map((user) => user.email);

      // Read the current output.json file
      const outputResponse = await fetch('/output.json');
      const { emails: alreadyEmailed } = await outputResponse.json();
      
      // Filter out users who have already been emailed
      const newEmails = selectedEmails.filter(email => !alreadyEmailed.includes(email));
      
      if (newEmails.length === 0) {
        toast.info('All selected users have already been emailed');
        setIsDialogOpen(false);
        setSelectedUsers([]);
        setIsUpdating(false);
        return;
      }

      // Add users to Resend audience
      toast.info(`Adding ${newEmails.length} users to Resend audience...`);
      const resendResult = await addUsersToResendAudience(newEmails);
      
      if (!resendResult.success && (!resendResult.successfulEmails || resendResult.successfulEmails.length === 0)) {
        toast.error('Failed to add any users to Resend audience. No early access granted.');
        console.error('Resend API error:', resendResult.error);
        return;
      }
      
      const successfulEmails = resendResult.successfulEmails || [];
      const failedEmails = resendResult.failedEmails || [];
      
      const successfulUserIds = selectedUsers
        .filter(user => successfulEmails.includes(user.email))
        .map(user => user.id);
      
      if (successfulUserIds.length === 0) {
        toast.error('No users were successfully added to Resend audience. No early access granted.');
        return;
      }

      // Update database
      toast.info(`Updating ${successfulUserIds.length} users in the database...`);
      const result = await updateEarlyAccessUsers(successfulUserIds);

      if (result.success) {
        // Update local state
        setEarlyAccessUsers((prev) =>
          prev.map((user) =>
            successfulUserIds.includes(user.id)
              ? { ...user, isEarlyAccess: true }
              : user,
          ),
        );

        // Send emails
        toast.info(`Sending welcome emails to ${successfulEmails.length} users...`);
        await sendEmailsToUsers(successfulEmails);
        toast.success(`Welcome emails sent to ${successfulEmails.length} users`);

        if (failedEmails.length > 0) {
          toast.warning(
            <div>
              <p>{successfulEmails.length} users added to Resend audience and granted early access</p>
              <p className="mt-1 text-amber-500">
                {failedEmails.length} users could not be added to the audience (no early access granted)
              </p>
              {failedEmails.length <= 5 && (
                <div className="mt-1 text-xs">
                  <p>Failed emails:</p>
                  <ul className="list-disc pl-4">
                    {failedEmails.map((email: string, i: number) => (
                      <li key={i}>{email}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>,
          );
        } else {
          toast.success(
            `All ${successfulEmails.length} users successfully added to Resend audience and granted early access`,
          );
        }
      } else {
        toast.error('Failed to update users in the database');
      }
    } catch (error) {
      console.error('Error in confirmation:', error);
      toast.error('An error occurred');
    } finally {
      setIsDialogOpen(false);
      setSelectedUsers([]);
      setIsUpdating(false);
    }
  };

  const addUsersToResendAudience = async (emails: string[]) => {
    // Show a loading toast
    const toastId = toast.loading(`Adding ${emails.length} users to Resend audience...`);
    
    try {
      const response = await fetch('/api/resend/add-to-audience', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emails }),
      });

      if (!response.ok) {
        console.error(`API response not OK: ${response.status} ${response.statusText}`);
        // Update toast to error
        toast.error(`Failed to add users to Resend audience: API returned ${response.status}`, {
          id: toastId,
        });
        return { success: false, error: `API returned ${response.status}` };
      }

      const data = (await response.json()) as ResendApiResponse;
      
      // Update toast based on result
      if (data.success) {
        const successCount = data.successfulCount || (data.successfulEmails?.length || 0);
        toast.success(`Successfully added ${successCount} users to Resend audience`, {
          id: toastId,
        });
      } else {
        toast.error(`Error adding users to Resend audience: ${data.error || 'Unknown error'}`, {
          id: toastId,
        });
      }
      
      return data;
    } catch (error) {
      console.error('Error adding users to Resend audience:', error);
      // Update toast to error
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to add users to Resend audience: ${errorMessage}`, {
        id: toastId,
      });
      return { success: false, error };
    }
  };

  const sendEmailsToUsers = async (emails: string[]) => {
    const toastId = toast.loading(`Sending emails to ${emails.length} users...`);
    
    try {
      // Read the current output.json file
      const outputResponse = await fetch('/output.json');
      const { emails: alreadyEmailed } = await outputResponse.json();
      
      // Filter out users who have already been emailed
      const newEmails = emails.filter(email => !alreadyEmailed.includes(email));
      
      if (newEmails.length === 0) {
        toast.info('All users have already been emailed', { id: toastId });
        return { success: true, alreadyEmailed: true };
      }

      const apiResponse = await fetch('/api/resend/send-early-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emails: newEmails,
          subject: 'Welcome to Zero Early Access!',
          content: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" lang="en">
  <head>
    <link
      rel="preload"
      as="image"
      href="https://i.imgur.com/xBnWSpN.png" />
    <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
    <meta name="x-apple-disable-message-reformatting" />
  </head>
  <body
    style='background-color:rgb(246,249,252);font-family:ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";padding-top:60px;padding-bottom:60px'>
    <div
      style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">
      You&#x27;ve been granted early access to Zero!
      <div>
        ‌​‍‎‏﻿
      </div>
    </div>
    <table
      align="center"
      width="100%"
      border="0"
      cellpadding="0"
      cellspacing="0"
      role="presentation"
      style="background-color:rgb(255,255,255);border-radius:8px;margin-left:auto;margin-right:auto;padding:32px;max-width:600px">
      <tbody>
        <tr style="width:100%">
          <td>
            <table
              align="center"
              width="100%"
              border="0"
              cellpadding="0"
              cellspacing="0"
              role="presentation"
              style="margin-bottom:32px">
              <tbody>
                <tr>
                  <td>
                    <img
                      alt="Zero Early Access"
                      src="https://i.imgur.com/xBnWSpN.png"
                      style="width:100%;height:auto;object-fit:cover;border-radius:4px;display:block;outline:none;border:none;text-decoration:none" />
                  </td>
                </tr>
              </tbody>
            </table>
            <h1
              style="font-size:24px;font-weight:700;color:rgb(51,51,51);margin-top:0px;margin-bottom:24px">
              Welcome to Zero Early Access!
            </h1>
            <p
              style="font-size:16px;line-height:24px;color:rgb(85,85,85);margin-bottom:16px;margin-top:16px">
              Hi there,
            </p>
            <p
              style="font-size:16px;line-height:24px;color:rgb(85,85,85);margin-bottom:32px;margin-top:16px">
              We&#x27;re thrilled to invite you to the exclusive early access
              program for Zero! We&#x27;ve been working hard to create an
              exceptional experience, and we&#x27;re incredibly excited to have
              you as one of our first users :) Click the button below to access Zero!
            </p>
            <table
              align="center"
              width="100%"
              border="0"
              cellpadding="0"
              cellspacing="0"
              role="presentation"
              style="text-align:center;margin-bottom:32px">
              <tbody>
                <tr>
                  <td>
                    <a
                      href="https://0.email/login"
                      style="background-color:rgb(0,0,0);color:rgb(255,255,255);font-weight:700;padding:16px 32px;border-radius:4px;text-decoration-line:none;text-align:center;box-sizing:border-box;line-height:100%;text-decoration:none;display:inline-block;max-width:100%;mso-padding-alt:0px"
                      target="_blank"
                      ><span
                        ><!--[if mso]><i style="mso-font-width:400%;mso-text-raise:18" hidden>&#8202;&#8202;&#8202;</i><![endif]--></span
                      ><span
                        style="max-width:100%;display:inline-block;line-height:120%;mso-padding-alt:0px;mso-text-raise:9px"
                        >Access Zero Now</span
                      ><span
                        ><!--[if mso]><i style="mso-font-width:400%" hidden>&#8202;&#8202;&#8202;&#8203;</i><![endif]--></span
                      ></a
                    >
                  </td>
                </tr>
              </tbody>
            </table>
            <p
              style="font-size:16px;line-height:24px;color:rgb(85,85,85);margin-bottom:24px;margin-top:16px">
              Join our
              <a
                href="https://discord.gg/0email"
                style="color:rgb(0,0,0);text-decoration-line:underline"
                target="_blank"
                >Discord community</a
              >
              to connect with other early users and the Zero team for support,
              feedback, and exclusive updates.
            </p>
            <p
              style="font-size:16px;line-height:24px;color:rgb(85,85,85);margin-bottom:24px;margin-top:16px">
              Your feedback during this early access phase is invaluable to us
              as we continue to refine and improve Zero. We can&#x27;t wait to
              hear what you think!
            </p>
            <hr
              style="border-color:rgb(230,235,241);margin-top:32px;margin-bottom:32px;width:100%;border:none;border-top:1px solid #eaeaea" />
            <p
              style="font-size:12px;line-height:16px;color:rgb(136,152,170);margin:0px;margin-bottom:16px;margin-top:16px">
              ©
              <!-- -->2025<!-- -->
              Zero Email Inc. All rights reserved.
            </p>
          </td>
        </tr>
      </tbody>
    </table>
  </body>
</html>`,
        }),
      });

      if (!apiResponse.ok) {
        console.error(`API response not OK: ${apiResponse.status} ${apiResponse.statusText}`);
        toast.error(`Failed to send emails: API returned ${apiResponse.status}`, {
          id: toastId,
        });
        return { success: false, error: `API returned ${apiResponse.status}` };
      }

      const data = (await apiResponse.json()) as ResendApiResponse;
      
      if (data.success) {
        const successCount = data.successfulCount || (data.successfulEmails?.length || 0);
        
        // Update output.json with newly emailed users
        if (data.successfulEmails && data.successfulEmails.length > 0) {
          const updatedEmails = [...alreadyEmailed, ...data.successfulEmails];
          await fetch('/api/update-emailed-users', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ emails: updatedEmails }),
          });
        }
        
        toast.success(`Successfully sent emails to ${successCount} users`, {
          id: toastId,
        });
      } else {
        toast.error(`Error sending emails: ${data.error || 'Unknown error'}`, {
          id: toastId,
        });
      }
      
      return data;
    } catch (error) {
      console.error('Error sending emails:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to send emails: ${errorMessage}`, {
        id: toastId,
      });
      return { success: false, error };
    }
  };

  return (
    <>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Early Access Selection</DialogTitle>
            <DialogDescription>
              You are about to grant early access to {selectedUsers.length} users. Please review the
              list below.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-auto rounded-md border p-2">
            {selectedUsers.map((user) => (
              <div key={user.id} className="border-b py-2 last:border-0">
                <p className="text-sm font-medium">{user.email}</p>
                <p className="text-muted-foreground text-xs">
                  Signed up: {format(new Date(user.createdAt), 'MMM d, yyyy')}
                </p>
              </div>
            ))}
          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={isUpdating}>
              Send Early Access Emails
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className='flex flex-col items-center justify-center w-full min-h-screen'>
        <div className="flex items-center justify-center w-72">
          <div className="w-full max-w-5xl rounded-md border">
            <div className="flex flex-col">
              <div className="border-b">
                <table className="w-full caption-bottom text-sm">
                  <thead>
                    <tr className="border-b transition-colors">
                      <th className="h-12 px-4 text-left align-middle font-medium">Email</th>
                      <th className="h-12 px-4 text-right align-right font-medium">
                        Early Access
                      </th>
                    </tr>
                  </thead>
                </table>
              </div>

              <div className="h-[300px] overflow-auto">
                <table className="w-full caption-bottom text-sm">
                  <tbody className="[&_tr:last-child]:border-0">
                    {earlyAccessUsers.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="text-muted-foreground p-4 text-center">
                          No early access signups found.
                        </td>
                      </tr>
                    ) : (
                      earlyAccessUsers.map((user: EarlyAccessUser) => (
                        <tr
                          key={user.id}
                          className="hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors flex justify-between"
                        >
                          <td className="p-4 align-middle truncate max-w-[15ch]">{user.email}</td>
                          <td className="p-4 align-middle">
                            <span
                              className={`rounded-md px-2 py-1 text-xs ${user.isEarlyAccess ? 'bg-blue-200 text-blue-800' : 'bg-red-200 text-red-800'}`}
                            >
                              {user.isEarlyAccess ? 'Yes' : 'No'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="border-t">
                <table className="w-full caption-bottom text-sm">
                  <tfoot>
                    <tr>
                      <td colSpan={2} className="text-muted-foreground p-4">
                        Total: {earlyAccessUsers.length}{' '}
                        {earlyAccessUsers.length === 1 ? 'user' : 'users'} | Early Access:{' '}
                        {earlyAccessCount} {earlyAccessCount === 1 ? 'user' : 'users'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-4 w-72">
          <Button
            onClick={selectRandomUsers}
            variant="default"
            disabled={earlyAccessUsers.filter((u) => !u.isEarlyAccess).length === 0 || isUpdating}
          >
            Randomize Early Access (
            {Math.min(5000, earlyAccessUsers.filter((u) => !u.isEarlyAccess).length)} users)
          </Button>
          
          <div className="flex flex-col gap-2">
            <Input
              placeholder="Enter emails (comma-separated)"
              value={customEmails}
              onChange={(e) => setCustomEmails(e.target.value)}
              disabled={isUpdating}
            />
            <Button
              onClick={handleCustomEmails}
              variant="secondary"
              disabled={!customEmails.trim() || isUpdating}
            >
              Grant Access to Specific Emails
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
