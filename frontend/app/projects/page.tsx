import { AppSidebar } from "@/components/Sidebar";
import { PageHeading } from "@/components/PageHeading";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default function ProjectsPage() {
  return (
    <SidebarProvider className="overflow-hidden">
      <AppSidebar />
      <SidebarInset className="w-0">
        <header className="flex h-12 shrink-0 items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
        </header>
        <div className="p-4 pt-0">
          <PageHeading />
          <p className="mt-6">Welcome to the Projects page!</p>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
