"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex flex-col space-y-2 border-b pb-4 pt-2 px-4", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
PageHeader.displayName = "PageHeader";

interface PageHeaderTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

const PageHeaderTitle = React.forwardRef<HTMLHeadingElement, PageHeaderTitleProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <h1
        ref={ref}
        className={cn("text-2xl font-semibold tracking-tight", className)}
        {...props}
      >
        {children}
      </h1>
    );
  }
);
PageHeaderTitle.displayName = "PageHeaderTitle";

interface PageHeaderDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

const PageHeaderDescription = React.forwardRef<HTMLParagraphElement, PageHeaderDescriptionProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={cn("text-sm text-muted-foreground", className)}
        {...props}
      >
        {children}
      </p>
    );
  }
);
PageHeaderDescription.displayName = "PageHeaderDescription";

// Attach subcomponents to PageHeader
PageHeader.Title = PageHeaderTitle;
PageHeader.Description = PageHeaderDescription;

export { PageHeader }; 