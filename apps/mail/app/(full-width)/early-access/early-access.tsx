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

  const earlyAccessCount = earlyAccessUsers.filter((user) => user.isEarlyAccess).length;

  const selectRandomUsers = () => {
    const nonEarlyAccessUsers = earlyAccessUsers.filter((user) => !user.isEarlyAccess);

    const shuffled = [...nonEarlyAccessUsers].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(100, shuffled.length));

    setSelectedUsers(selected);
    setIsDialogOpen(true);
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

  const handleConfirm = async () => {
    try {
      setIsUpdating(true);
      const selectedEmails = selectedUsers.map((user) => user.email);

      toast.info(`Adding ${selectedEmails.length} users to Resend audience...`);
      const resendResult = await addUsersToResendAudience(selectedEmails);
      
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
      
      toast.info(`Updating ${successfulUserIds.length} users in the database...`);
      const result = await updateEarlyAccessUsers(successfulUserIds);

      if (result.success) {
        setEarlyAccessUsers((prev) =>
          prev.map((user) =>
            successfulUserIds.includes(user.id)
              ? { ...user, isEarlyAccess: true }
              : user,
          ),
        );

        toast.success(`${successfulUserIds.length} users granted early access in the database`);

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
                    {failedEmails.slice(0, 5).map((email: string, i: number) => (
                      <li key={i}>{email}</li>
                    ))}
                    {failedEmails.length > 5 && (
                      <li>...and {failedEmails.length - 5} more</li>
                    )}
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

  const closeDialog = () => {
    setIsDialogOpen(false);
    setSelectedUsers([]);
  };

  return (
    <>
      <ConfirmationDialog
        isOpen={isDialogOpen}
        onClose={closeDialog}
        selectedUsers={selectedUsers}
        onConfirm={handleConfirm}
      />

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

        <Button
          onClick={selectRandomUsers}
          variant="default"
          className="mt-4 w-72"
          disabled={earlyAccessUsers.filter((u) => !u.isEarlyAccess).length === 0 || isUpdating}
        >
          Randomize Early Access (
          {Math.min(100, earlyAccessUsers.filter((u) => !u.isEarlyAccess).length)} users)
        </Button>
      </div>
    </>
  );
}
