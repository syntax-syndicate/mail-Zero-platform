import { SidebarToggle } from "@/components/ui/sidebar-toggle";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full bg-sidebar">
      <div className="flex-col overflow-hidden bg-background dark:bg-[#090909] dark:text-gray-100 md:m-2 md:ml-0 md:flex md:rounded-md md:border">
        <div>
          <SidebarToggle className="ml-2 mt-1.5 h-fit md:hidden" />
        </div>
        <div className="ml-2 h-full max-h-full">
          <div className="min-h-[calc(100vh-64px)] pt-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
