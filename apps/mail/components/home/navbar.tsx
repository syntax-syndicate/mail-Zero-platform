"use client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "../ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "../ui/button";
import Image from "next/image";
import Link from "next/link";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  // Automatically lose sheet on lg screen
  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    function handleChange(e: MediaQueryListEvent | MediaQueryList) {
      if (e.matches) setOpen(false);
    }
    handleChange(mediaQuery);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return (
    <div className="mx-auto flex w-full items-center justify-between p-4 px-3 lg:px-4">
      <Link href="/" className="text-3xl font-black">
        Zero
      </Link>
      {/* Mobile Navigation */}
      <div className="lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="cursor-pointer">
            <Menu className="dark:hover:bg-accent h-9 w-9 rounded-md p-2 text-gray-800 hover:bg-gray-100 dark:text-white" />
          </SheetTrigger>
          <SheetContent
            side="top"
            className="w-full !translate-y-0 border-none bg-white px-4 py-4 !duration-0 data-[state=closed]:!translate-y-0 data-[state=open]:!translate-y-0 dark:bg-black"
          >
            <SheetHeader className="">
              <VisuallyHidden>
                <SheetTitle>Navigation Menu</SheetTitle>
              </VisuallyHidden>
            </SheetHeader>
            <div className="flex h-screen flex-col">
              <div className="flex items-center justify-between px-3">
                <Image
                  src="/white-icon.svg"
                  alt="zerodotemail"
                  className="h-9 w-9 invert dark:invert-0"
                  width={180}
                  height={180}
                />
                <SheetTrigger asChild>
                  <X className="dark:hover:bg-accent h-9 w-9 cursor-pointer rounded-md p-2 text-gray-800 hover:bg-gray-100 dark:text-white" />
                </SheetTrigger>
              </div>
              <div className="mt-7 space-y-4 px-3">
                <Button
                  className="w-full bg-gray-900 text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-white/90"
                  asChild
                >
                  <Link href="https://cal.com/team/0/chat">Contact Us</Link>
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {process.env.NODE_ENV === "development" ? (
        <>
          <div className="hidden items-center gap-4 lg:flex">
            
            <Button
              className="h-[38px] px-5 rounded-[10px] bg-gray-900 text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-white/90"
              asChild
            >
              <Link href="/login"><p className="text-xs font-[700]">Get Started With Zero</p></Link>
            </Button>
          </div>
        </>
      ) : (
        <Button
          className="hidden h-[32px] w-[110px] rounded-md bg-gray-900 text-white hover:bg-black lg:flex dark:bg-white dark:text-black dark:hover:bg-white/90"
          asChild
        >
          <Link href="https://cal.com/team/0/chat">Contact Us</Link>
        </Button>
      )}
    </div>
  );
}
