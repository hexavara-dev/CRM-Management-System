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
import { useCustomers } from "@/hooks/use-customers";
import {
  CustomerFormData,
  customerFormSchema,
} from "@/schemas/customer.schema";
import { Customer } from "@/types/customer";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";

export default function ContactsPage() {
  const {
    customers,
    isLoading,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    isCreating,
    isUpdating,
    isDeleting,
  } = useCustomers();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );

  const columns = useMemo<ColumnDef<Customer>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        accessorFn: (row) => `${row.firstName} ${row.lastName || ""}`.trim(),
        cell: ({ row }) => {
          const name = row.getValue("name") as string;
          return (
            <div
              className="text-blue-400 font-medium cursor-pointer hover:underline"
              onClick={() => {
                setSelectedCustomer(row.original);
                setIsViewDialogOpen(true);
              }}
            >
              {name}
            </div>
          );
        },
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => row.getValue("email") || "-",
      },
      {
        accessorKey: "phoneNumber",
        header: "Phone",
        cell: ({ row }) => row.getValue("phoneNumber") || "-",
      },
      {
        id: "company",
        header: "Company",
        accessorFn: (row) => row.organization?.name || "-",
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => {
          const dateValue = row.getValue("createdAt") as
            | string
            | null
            | undefined;
          if (!dateValue) return "-";
          const date = new Date(dateValue);
          return isNaN(date.getTime()) ? "-" : date.toLocaleDateString("id-ID");
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const customer = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openViewDialog(customer)}
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openEditDialog(customer)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(customer.id)}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          );
        },
      },
    ],
    [],
  );

  const addForm = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      gender: "",
      salutation: "",
    },
  });

  const editForm = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      gender: "",
      salutation: "",
    },
  });

  const onSubmitAdd = async (data: CustomerFormData) => {
    try {
      await createCustomer(data);
      addForm.reset();
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error("Failed to add customer:", error);
    }
  };

  const onSubmitEdit = async (data: CustomerFormData) => {
    if (selectedCustomer) {
      try {
        await updateCustomer({ id: selectedCustomer.id, data });
        editForm.reset();
        setIsEditDialogOpen(false);
        setSelectedCustomer(null);
      } catch (error) {
        console.error("Failed to update customer:", error);
      }
    }
  };

  const handleDelete = (id: string) => {
    setSelectedCustomer(customers?.data.find((c) => c.id === id) || null);
    setIsDeleteDialogOpen(true);
  };

  const onConfirmDelete = async () => {
    if (selectedCustomer) {
      try {
        await deleteCustomer(selectedCustomer.id);
        setIsDeleteDialogOpen(false);
        setSelectedCustomer(null);
      } catch (error) {
        console.error("Failed to delete customer:", error);
      }
    }
  };

  const openEditDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    editForm.reset({
      firstName: customer.firstName,
      lastName: customer.lastName || "",
      email: customer.email || "",
      phoneNumber: customer.phoneNumber || "",
      gender: customer.gender || "",
      salutation: customer.salutation || "",
    });
    setIsEditDialogOpen(true);
  };

  const openViewDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsViewDialogOpen(true);
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-8 !self-center" />
          <div className="flex flex-1 items-center justify-between">
            <h1 className="text-lg font-semibold">Contacts</h1>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => addForm.reset()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Contact
                </Button>
              </DialogTrigger>
              <DialogContent className="min-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Contact</DialogTitle>
                  <DialogDescription>
                    Enter the contact information below.
                  </DialogDescription>
                </DialogHeader>
                <FormProvider {...addForm}>
                  <form
                    onSubmit={addForm.handleSubmit(onSubmitAdd)}
                    className="grid grid-cols-2 gap-4 py-4"
                  >
                    <FormInput
                      name="firstName"
                      label="First Name"
                      placeholder="First Name"
                      className="col-span-1"
                    />
                    <FormInput
                      name="lastName"
                      label="Last Name"
                      placeholder="Last Name"
                      className="col-span-1"
                    />
                    <FormInput
                      name="email"
                      label="Email"
                      type="email"
                      placeholder="email@example.com"
                      className="col-span-1"
                    />
                    <FormInput
                      name="phoneNumber"
                      label="Phone"
                      placeholder="+62 xxx xxxx xxxx"
                      className="col-span-1"
                    />
                    <FormInput
                      name="salutation"
                      label="Salutation"
                      placeholder="e.g., Mr, Mrs, Ms"
                      className="col-span-1"
                    />
                    <FormInput
                      name="gender"
                      label="Gender"
                      placeholder="e.g., Male, Female"
                      className="col-span-1"
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
                          {isCreating ? "Saving..." : "Save Contact"}
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
              <CardTitle>Contacts Management</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div>Loading contacts...</div>
              ) : (
                <DataTable
                  columns={columns}
                  data={customers?.data || []}
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
            <DialogTitle>Edit Contact</DialogTitle>
            <DialogDescription>
              Update the contact information below.
            </DialogDescription>
          </DialogHeader>
          <FormProvider {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(onSubmitEdit)}
              className="grid grid-cols-2 gap-4 py-4"
            >
              <FormInput
                name="firstName"
                label="First Name"
                className="col-span-1"
              />
              <FormInput
                name="lastName"
                label="Last Name"
                className="col-span-1"
              />
              <FormInput
                name="email"
                label="Email"
                type="email"
                className="col-span-1"
              />
              <FormInput
                name="phoneNumber"
                label="Phone"
                className="col-span-1"
              />
              <FormInput
                name="salutation"
                label="Salutation"
                className="col-span-1"
              />
              <FormInput name="gender" label="Gender" className="col-span-1" />
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

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Contact Details</DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Name</label>
                <p className="text-sm">
                  {selectedCustomer.firstName} {selectedCustomer.lastName || ""}
                </p>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Email</label>
                <p className="text-sm">{selectedCustomer.email || "-"}</p>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Phone</label>
                <p className="text-sm">{selectedCustomer.phoneNumber || "-"}</p>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Company</label>
                <p className="text-sm">
                  {selectedCustomer.organization?.name || "-"}
                </p>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Salutation</label>
                <p className="text-sm">{selectedCustomer.salutation || "-"}</p>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Gender</label>
                <p className="text-sm">{selectedCustomer.gender || "-"}</p>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Created</label>
                <p className="text-sm">
                  {selectedCustomer.createdAt
                    ? new Date(selectedCustomer.createdAt).toLocaleDateString(
                        "id-ID",
                      )
                    : "-"}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsViewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={onConfirmDelete}
        title="Delete Contact"
        description="Are you sure you want to delete this contact? This action cannot be undone."
        loading={isDeleting}
      />
    </SidebarProvider>
  );
}
