'use client';

import { createContext, useContext, useState, useRef, type ReactNode, useCallback } from 'react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const ConfirmDialogContext = createContext<{
  confirm: (message: string) => Promise<boolean>;
} | null>(null);

export const useConfirmDialog = () => {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    throw new Error('useConfirmDialog must be used within a ConfirmDialogProvider');
  }

  return context;
};

export const ConfirmDialogProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const resolver = useRef<(value: boolean) => void>(null);

  const confirm = useCallback((message: string) => {
    setMessage(message);
    setOpen(true);

    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const handleConfirm = () => {
    setOpen(false);
    resolver.current?.(true);
    resolver.current = null;
  };

  const handleCancel = () => {
    setOpen(false);
    resolver.current?.(false);
    resolver.current = null;
  };

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <p className="text-foreground text-sm">{message}</p>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => {
                handleCancel();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                handleConfirm();
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmDialogContext.Provider>
  );
};
