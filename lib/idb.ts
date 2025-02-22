"use client";
import Dexie, { type EntityTable } from "dexie";
import { ParsedMessage } from "@/types";

interface KanbanState {
  emailId: string;
  columnId: string;
  position: number;
  lastModified: Date;
}

interface UserPreferences {
  id: "viewMode";
  value: "list" | "kanban";
}

const idb = new Dexie("mail0") as Dexie & {
  threads: EntityTable<
    ParsedMessage,
    "id" // primary key "id" (for the typings only)
  >;
  kanbanState: EntityTable<KanbanState, "emailId">;
  preferences: EntityTable<UserPreferences, "id">;
};

idb.version(3).stores({
  threads: "++id, title, tags, sender, receivedOn, unread, body, processedHtml, blobUrl, q",
  kanbanState: "emailId, columnId, position, lastModified",
  preferences: "id, value",
});

export { idb };
