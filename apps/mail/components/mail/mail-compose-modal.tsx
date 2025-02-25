"use client";

import { useOpenComposeModal } from "@/hooks/use-open-compose-modal";
import ResponsiveModal from "../responsive-modal";
import { MailCompose } from "./mail-compose";

export default function MailComposeModal() {
  const { isOpen, setIsOpen, close } = useOpenComposeModal();

  return (
    <ResponsiveModal className="w-full md:max-w-[800px]" open={isOpen} onOpenChange={setIsOpen}>
      <MailCompose onClose={close} />
    </ResponsiveModal>
  );
}
