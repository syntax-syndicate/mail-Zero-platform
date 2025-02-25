import {
  EditorContent,
  TiptapImage,
  TiptapLink,
  UpdatedImage,
  TaskList,
  TaskItem,
  HorizontalRule,
  StarterKit,
  Placeholder,
  EditorBubble,
} from "novel";

import { NodeSelector } from "./editor.node-selector";
import { LinkSelector } from "./editor.link-selector";
import { TextButtons } from "./editor.text-buttons";
import { cx } from "class-variance-authority";
// import { ColorSelector } from "./editor.colors";
import { useState } from "react";

const placeholder = Placeholder;
const tiptapLink = TiptapLink.configure({
  HTMLAttributes: {
    class: cx(
      "text-muted-foreground underline underline-offset-[3px] hover:text-primary transition-colors cursor-pointer",
    ),
  },
});

const taskList = TaskList.configure({
  HTMLAttributes: {
    class: cx("not-prose pl-2"),
  },
});
const taskItem = TaskItem.configure({
  HTMLAttributes: {
    class: cx("flex items-start my-4"),
  },
  nested: true,
});

const horizontalRule = HorizontalRule.configure({
  HTMLAttributes: {
    class: cx("mt-4 mb-6 border-t border-muted-foreground"),
  },
});

const starterKit = StarterKit.configure({
  bulletList: {
    HTMLAttributes: {
      class: cx("list-disc list-outside leading-3 -mt-2"),
    },
  },
  orderedList: {
    HTMLAttributes: {
      class: cx("list-decimal list-outside leading-3 -mt-2"),
    },
  },
  listItem: {
    HTMLAttributes: {
      class: cx("leading-normal -mb-2"),
    },
  },
  blockquote: {
    HTMLAttributes: {
      class: cx("border-l-4 border-primary"),
    },
  },
  codeBlock: {
    HTMLAttributes: {
      class: cx("rounded-sm bg-muted border p-5 font-mono font-medium"),
    },
  },
  code: {
    HTMLAttributes: {
      class: cx("rounded-md bg-muted  px-1.5 py-1 font-mono font-medium"),
      spellcheck: "false",
    },
  },
  horizontalRule: false,
  dropcursor: {
    color: "#DBEAFE",
    width: 4,
  },
  gapcursor: false,
});

const defaultExtensions = [
  starterKit,
  placeholder,
  tiptapLink,
  TiptapImage,
  UpdatedImage,
  taskList,
  taskItem,
  horizontalRule,
];

export const MailEditor = () => {
  const [openNode, setOpenNode] = useState(false);
  const [openLink, setOpenLink] = useState(false);
  // const [openColor, setOpenColor] = useState(false);

  return (
    <EditorContent
      extensions={defaultExtensions}
      className="w-full resize-none overflow-y-auto rounded-md border border-input bg-background p-4 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 h-72"
    >
      <EditorBubble className="flex w-fit max-w-[90vw] overflow-hidden rounded border border-muted bg-background shadow-xl">
        <NodeSelector open={openNode} onOpenChange={setOpenNode} />
        <LinkSelector open={openLink} onOpenChange={setOpenLink} />
        <TextButtons />
        {/* <ColorSelector open={openColor} onOpenChange={setOpenColor} /> */}
      </EditorBubble>
    </EditorContent>
  );
};
