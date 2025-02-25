import { Dialog, DialogContent, DialogHeader, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { DialogTitle } from "@radix-ui/react-dialog";
import { type ReactElement } from "react";
import { useMedia } from "react-use";
import { cn } from "@/lib/utils";

type ResponsiveModalProps = {
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
};

export default function ResponsiveModal({
  children,
  open,
  onOpenChange,
  className,
}: ResponsiveModalProps): ReactElement {
  const isDesktop = useMedia("(min-width: 1024px)", true);

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <VisuallyHidden>
          <DialogHeader>
            <DialogTitle>Title</DialogTitle>
            <DialogDescription>Modal content</DialogDescription>
          </DialogHeader>
        </VisuallyHidden>
        <DialogContent
          className={cn(
            "hide-scrollbar w-full overflow-y-auto border-none p-0 sm:max-w-lg",
            className,
          )}
        >
          {children}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <VisuallyHidden>
          <DrawerHeader>
            <DrawerTitle>Title</DrawerTitle>
          </DrawerHeader>
        </VisuallyHidden>
        <div className="hide-scrollbar overflow-y-auto">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}
