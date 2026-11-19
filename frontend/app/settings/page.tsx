"use client";

import { AppSidebar } from "@/components/Sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LocationManagementTab } from "./components/location-management-tab";
import { SourceManagementTab } from "./components/source-management-tab";
import { StatusManagementTab } from "./components/status-management-tab";

export default function SettingsPage() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex flex-1 items-center justify-between">
            <h1 className="text-lg font-semibold">Settings</h1>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4">
          <Tabs defaultValue="lead-statuses" className="space-y-4">
            <TabsList>
              <TabsTrigger value="lead-statuses">Lead Statuses</TabsTrigger>
              <TabsTrigger value="viewing-statuses">Visit Statuses</TabsTrigger>
              <TabsTrigger value="viewing-sources">Visit Sources</TabsTrigger>
              <TabsTrigger value="locations">Units</TabsTrigger>
            </TabsList>

            <TabsContent value="lead-statuses">
              <StatusManagementTab
                type="lead"
                title="Lead Statuses"
                addButtonLabel="Add Lead Status"
                dialogTitle="Add Lead Status"
                dialogDescription="Create a status used by leads."
              />
            </TabsContent>

            <TabsContent value="viewing-statuses">
              <StatusManagementTab
                type="viewing"
                title="Visit Statuses"
                addButtonLabel="Add Visit Status"
                dialogTitle="Add Visit Status"
                dialogDescription="Create a status used by visit schedules."
              />
            </TabsContent>

            <TabsContent value="viewing-sources">
              <SourceManagementTab
                type="viewing"
                title="Visit Sources"
                addButtonLabel="Add Visit Source"
                dialogTitle="Add Visit Source"
                dialogDescription="Create source options for visit schedules."
                placeholder="e.g. Pribadi"
              />
            </TabsContent>

            <TabsContent value="locations">
              <LocationManagementTab />
            </TabsContent>
          </Tabs>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
