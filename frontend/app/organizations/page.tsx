"use client";

import { AppSidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormInput } from "@/components/ui/form-input";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useOrganizations } from "@/hooks/use-organizations";
import {
  OrganizationFormData,
  organizationFormSchema,
} from "@/schemas/organization.schema";
import { Organization } from "@/types/organization";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";

export default function OrganizationsPage() {
  const router = useRouter();
  const {
    organizations,
    isLoading,
    createOrganization,
    updateOrganization,
    deleteOrganization,
    isCreating,
    isUpdating,
    isDeleting,
  } = useOrganizations();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedOrganization, setSelectedOrganization] =
    useState<Organization | null>(null);

  const columns = useMemo<ColumnDef<Organization>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Organization",
        cell: ({ row }) => (
          <button
            type="button"
            className="text-blue-400 font-medium text-left hover:underline"
            onClick={() => router.push(`/organizations/${row.original.id}`)}
          >
            {row.getValue("name")}
          </button>
        ),
      },
      {
        accessorKey: "location",
        header: "Location",
        cell: ({ row }) => row.getValue("location") || "-",
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const org = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openEditDialog(org)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(org.id)}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          );
        },
      },
    ],
    [router],
  );

  const addForm = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: {
      name: "",
      location: "",
    },
  });

  const editForm = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: {
      name: "",
      location: "",
    },
  });

  const onSubmitAdd = async (data: OrganizationFormData) => {
    try {
      await createOrganization(data);
      addForm.reset();
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error("Failed to add organization:", error);
    }
  };

  const onSubmitEdit = async (data: OrganizationFormData) => {
    if (selectedOrganization) {
      try {
        await updateOrganization({ id: selectedOrganization.id, data });
        editForm.reset();
        setIsEditDialogOpen(false);
        setSelectedOrganization(null);
      } catch (error) {
        console.error("Failed to update organization:", error);
      }
    }
  };

  const handleDelete = (id: string) => {
    setSelectedOrganization(
      organizations?.data.find((o) => o.id === id) || null,
    );
    setIsDeleteDialogOpen(true);
  };

  const onConfirmDelete = async () => {
    if (selectedOrganization) {
      try {
        await deleteOrganization(selectedOrganization.id);
        setIsDeleteDialogOpen(false);
        setSelectedOrganization(null);
      } catch (error) {
        console.error("Failed to delete organization:", error);
      }
    }
  };

  const openEditDialog = (org: Organization) => {
    setSelectedOrganization(org);
    editForm.reset({
      name: org.name,
      location: org.location || "",
    });
    setIsEditDialogOpen(true);
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-8 !self-center" />
          <div className="flex flex-1 items-center justify-between">
            <h1 className="text-lg font-semibold">Organizations</h1>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => addForm.reset()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Organization
                </Button>
              </DialogTrigger>
              <DialogContent className="min-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Organization</DialogTitle>
                  <DialogDescription>
                    Enter the organization information below.
                  </DialogDescription>
                </DialogHeader>
                <FormProvider {...addForm}>
                  <form
                    onSubmit={addForm.handleSubmit(onSubmitAdd)}
                    className="grid grid-cols-2 gap-4 py-4"
                  >
                    <FormInput
                      name="name"
                      label="Organization Name"
                      placeholder="Organization Name"
                      className="col-span-2"
                    />
                    <FormInput
                      name="location"
                      label="Location"
                      placeholder="e.g., Jakarta, Surabaya"
                      className="col-span-2"
                    />
                    <div className="col-span-2">
                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsAddDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={isCreating}>
                          {isCreating ? "Saving..." : "Save Organization"}
                        </Button>
                      </DialogFooter>
                    </div>
                  </form>
                </FormProvider>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4">
          <Card>
            <CardHeader>
              <CardTitle>Organization List</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div>Loading organizations...</div>
              ) : (
                <DataTable
                  columns={columns}
                  data={organizations?.data || []}
                  searchKey="name"
                />
              )}
            </CardContent>
          </Card>
        </div>
      </SidebarInset>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="min-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            <DialogDescription>
              Update the organization information below.
            </DialogDescription>
          </DialogHeader>
          <FormProvider {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(onSubmitEdit)}
              className="grid grid-cols-2 gap-4 py-4"
            >
              <FormInput
                name="name"
                label="Organization Name"
                className="col-span-2"
              />
              <FormInput
                name="location"
                label="Location"
                className="col-span-2"
              />
              <div className="col-span-2">
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating ? "Saving..." : "Save Changes"}
                  </Button>
                </DialogFooter>
              </div>
            </form>
          </FormProvider>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={onConfirmDelete}
        title="Delete Organization"
        description="Are you sure you want to delete this organization? This action cannot be undone."
        loading={isDeleting}
      />
    </SidebarProvider>
  );
}
