import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { TooltipPortal } from "@radix-ui/react-tooltip";
import { useState, useEffect } from "react";
import { InitialThread } from "@/types";
import { idb } from "@/lib/idb";

interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  description: string;
  emails: InitialThread[];
}

interface MailKanbanProps {
  items: InitialThread[];
  onMailClick: (message: InitialThread) => void;
}

export function MailKanban({ items, onMailClick }: MailKanbanProps) {
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load initial state
  useEffect(() => {
    async function loadKanbanState() {
      try {
        // Get saved positions from IndexedDB
        const savedPositions = await idb.kanbanState.toArray();

        // Create initial columns structure
        const initialColumns: Record<string, KanbanColumn> = {
          later: {
            id: "later",
            title: "Do Later",
            color: "amber",
            description: "Can wait",
            emails: [] as InitialThread[],
          },
          important: {
            id: "important",
            title: "Important",
            color: "red",
            description: "Need to handle soon",
            emails: [] as InitialThread[],
          },
          inProgress: {
            id: "in-progress",
            title: "In Progress",
            color: "blue",
            description: "Sent and waiting for reply",
            emails: [] as InitialThread[],
          },
          done: {
            id: "done",
            title: "Done",
            color: "green",
            description: "Completed",
            emails: [] as InitialThread[],
          },
        };

        // Distribute emails based on saved positions
        items.forEach((email) => {
          const savedPosition = savedPositions.find((pos) => pos.emailId === email.id);
          if (savedPosition && savedPosition.columnId in initialColumns) {
            initialColumns[savedPosition.columnId as keyof typeof initialColumns].emails.push(
              email,
            );
          } else {
            // If no saved position or invalid column, put in 'later' by default
            console.warn(
              `Invalid or missing column for email ${email.id}. ` +
                `Column ID: ${savedPosition?.columnId}. Defaulting to 'later'.`,
            );
            initialColumns.later.emails.push(email);
          }
        });

        setColumns(Object.values(initialColumns));
        setIsLoading(false);
      } catch (error) {
        console.error("Error loading kanban state:", error);
        // Fallback to default state
        setColumns([
          {
            id: "later",
            title: "Do Later",
            color: "amber",
            description: "Can wait",
            emails: items,
          },
          {
            id: "important",
            title: "Important",
            color: "red",
            description: "Need to handle soon",
            emails: [],
          },
          {
            id: "in-progress",
            title: "In Progress",
            color: "blue",
            description: "Sent and waiting for reply",
            emails: [],
          },
          {
            id: "done",
            title: "Done",
            color: "green",
            description: "Completed",
            emails: [],
          },
        ]);
        setIsLoading(false);
      }
    }

    loadKanbanState();
  }, [items]);

  const saveKanbanState = async (newColumns: KanbanColumn[]) => {
    try {
      const positions = newColumns.flatMap((column) =>
        column.emails.map((email, index) => ({
          emailId: email.id,
          columnId: column.id,
          position: index,
          lastModified: new Date(),
        })),
      );

      await idb.transaction("rw", idb.kanbanState, async () => {
        await idb.kanbanState.clear();
        await idb.kanbanState.bulkAdd(positions);
      });
    } catch (error) {
      console.error("Error saving kanban state:", error);
    }
  };

  const onDragEnd = (result: any) => {
    if (!result.destination) return;

    const { source, destination } = result;
    const newColumns = [...columns];

    if (source.droppableId === destination.droppableId) {
      const column = newColumns.find((col) => col.id === source.droppableId);
      if (!column) return;

      const newEmails = Array.from(column.emails);
      const [removed] = newEmails.splice(source.index, 1);
      newEmails.splice(destination.index, 0, removed);

      const updatedColumns = newColumns.map((col) =>
        col.id === source.droppableId ? { ...col, emails: newEmails } : col,
      );

      setColumns(updatedColumns);
      saveKanbanState(updatedColumns);
    } else {
      const sourceColumn = newColumns.find((col) => col.id === source.droppableId);
      const destColumn = newColumns.find((col) => col.id === destination.droppableId);
      if (!sourceColumn || !destColumn) return;

      const sourceEmails = Array.from(sourceColumn.emails);
      const destEmails = Array.from(destColumn.emails);
      const [removed] = sourceEmails.splice(source.index, 1);
      destEmails.splice(destination.index, 0, removed);

      const updatedColumns = newColumns.map((col) => {
        if (col.id === source.droppableId) {
          return { ...col, emails: sourceEmails };
        }
        if (col.id === destination.droppableId) {
          return { ...col, emails: destEmails };
        }
        return col;
      });

      setColumns(updatedColumns);
      saveKanbanState(updatedColumns);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex h-full gap-4 p-4">
        {columns.map((column) => (
          <div key={column.id} className="flex-1">
            <div className="mb-4 flex items-center gap-2">
              <div
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor:
                    column.id === "later"
                      ? "#FDB022"
                      : column.id === "important"
                        ? "#F04438"
                        : column.id === "in-progress"
                          ? "#016FFE"
                          : "#16B364",
                }}
              />
              <h3 className="text-sm font-semibold">{column.title}</h3>
            </div>
            <Droppable droppableId={column.id}>
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="min-h-[200px] rounded-lg bg-muted/50 p-2"
                >
                  {column.emails.map((email, index) => (
                    <Draggable key={email.id} draggableId={email.id} index={index}>
                      {(provided) => (
                        <Tooltip delayDuration={700}>
                          <TooltipTrigger asChild>
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className="mb-2 rounded-md bg-background p-3 shadow-sm hover:bg-muted/50"
                              onClick={() => onMailClick(email)}
                            >
                              <p className="text-sm font-medium">{email.sender.name}</p>
                              <p className="line-clamp-2 text-xs text-muted-foreground">
                                {email.title}
                              </p>
                            </div>
                          </TooltipTrigger>
                          <TooltipPortal>
                            <TooltipContent className="w-80" sideOffset={6}>
                              <p className="text-sm">
                                Meeting scheduled for next week to discuss the Q4 planning. Key
                                points to be covered include budget allocation, team restructuring,
                                and new project initiatives. Please review the attached documents
                                before the meeting.
                              </p>
                            </TooltipContent>
                          </TooltipPortal>
                        </Tooltip>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}
