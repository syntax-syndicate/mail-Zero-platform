"use client";

import { ListFilter, Trello } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

interface ViewToggleProps {
  view: "list" | "kanban";
  onChange: (view: "list" | "kanban") => void;
  className?: string;
}

export function EmailViewToggle({ view, onChange, className }: ViewToggleProps) {
  const [isRendered, setIsRendered] = useState(false);

  // Prevents hydration error
  useEffect(() => setIsRendered(true), []);

  async function handleViewToggle() {
    const newView = view === "list" ? "kanban" : "list";

    function update() {
      onChange(newView);
    }

    if (document.startViewTransition) {
      document.documentElement.style.viewTransitionName = "view-transition";
      await document.startViewTransition(update).finished;
      document.documentElement.style.viewTransitionName = "";
    } else {
      update();
    }
  }

  if (!isRendered) return null;

  return (
    <Button variant="ghost" onClick={handleViewToggle} className={`md:h-fit md:px-2 ${className}`}>
      {view === "list" ? <ListFilter className={className} /> : <Trello className={className} />}
    </Button>
  );
}
