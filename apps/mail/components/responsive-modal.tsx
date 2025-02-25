import { X, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type ReactElement } from "react";
import { useMedia } from "react-use";
import { cn } from "@/lib/utils";
import * as React from "react";

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
  const isMobile = useMedia("(max-width: 640px)", false);
  const [isMinimized, setIsMinimized] = React.useState(false);

  // Handle minimizing and maximizing the compose window
  const toggleMinimize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsMinimized(!isMinimized);
  };

  if (!open) return <></>;

  return (
    <div className={cn(
      "fixed z-50 ",
      isMobile ? "bottom-0 right-0 left-0" : "bottom-5 right-5"
    )}>
      <div 
        className={cn(
          "border rounded-lg shadow-lg transition-all duration-200 ease-in-out",
          isMobile ? "w-full rounded-b-none" : "w-[500px]",
          isMinimized 
            ? "h-[56px] overflow-hidden" 
            : isMobile 
              ? "h-[80vh]" 
              : "h-[600px] max-h-[100vh]",
          className
        )}
      >
        <div className="flex flex-col h-full">
          <div 
            className="px-4 py-2 flex justify-between items-center cursor-pointer rounded-t-md"
            onClick={toggleMinimize}
          >
            <h3 className="font-medium text-sm">
              New Email
            </h3>
            <div className="flex items-center gap-2">
              {!isMinimized && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6"
                  onClick={toggleMinimize}
                >
                  <span className="sr-only">Minimize</span>
                  <svg width="10" height="2" viewBox="0 0 10 2" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 1H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </Button>
              )}
              {isMinimized && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6"
                  onClick={toggleMinimize}
                >
                  <span className="sr-only">Maximize</span>
                  <Maximize2 className="h-4 w-4" />
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenChange(false);
                }}
              >
                <span className="sr-only">Close</span>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {!isMinimized && (
            <div className="flex-1 overflow-auto">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
