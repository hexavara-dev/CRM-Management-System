"use client";

import { AppSidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { DataTable } from "@/components/ui/data-table";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useAuth } from "@/components/auth/auth-provider";
import { useUsers } from "@/hooks/use-users";
import type { User } from "@/types/user";
import { createUserSchema, CreateUserFormData } from "@/schemas/user.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import type { ColumnDef } from "@tanstack/react-table";

export default function TeamPage() {
  const { user, register } = useAuth();
  const { users, isLoading, deleteUser, isCreating, isDeleting } = useUsers();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const handleDelete = useCallback(
    (id: string) => {
      const userToDelete = users.find((u) => u.id === id) || null;
      setSelectedUser(userToDelete);
      setIsDeleteDialogOpen(true);
    },
    [users],
  );

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        accessorKey: "email",
        header: "Email",
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => row.getValue("name") || "-",
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => (
          <span className="capitalize">{row.getValue("role")}</span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Created At",
        cell: ({ row }) => {
          const date = new Date(row.getValue("createdAt"));
          return date.toLocaleDateString("id-ID");
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const user = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(user.id)}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          );
        },
      },
    ],
    [handleDelete],
  );

  const form = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: "",
      name: "",
      password: "",
    },
  });

  const onSubmit = async (data: CreateUserFormData) => {
    try {
      const payload = {
        ...data,
        tenantId: user?.tenantId,
      };
      await register(payload);
      form.reset();
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error("Failed to create user:", error);
    }
  };

  const onConfirmDelete = async () => {
    if (selectedUser) {
      try {
        await deleteUser(selectedUser.id);
        setIsDeleteDialogOpen(false);
        setSelectedUser(null);
      } catch (error) {
        console.error("Failed to delete user:", error);
      }
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-8 !self-center" />
          <div className="flex flex-1 items-center justify-between">
            <h1 className="text-lg font-semibold">Team Management</h1>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => form.reset()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New User</DialogTitle>
                  <DialogDescription>
                    Create a new user for your team.
                  </DialogDescription>
                </DialogHeader>
                <FormProvider {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="grid grid-cols-2 gap-4"
                  >
                    <FormInput
                      name="email"
                      label="Email"
                      type="email"
                      placeholder="user@example.com"
                      className="col-span-2"
                    />
                    <FormInput
                      name="name"
                      label="Name"
                      placeholder="User name"
                    />
                    <FormInput
                      name="password"
                      label="Password"
                      type="password"
                      placeholder="Min 6 characters"
                    />
                    {/* <div className="col-span-2">
                      <FormSelect
                        name="role"
                        label="Role"
                        options={roleOptions}
                        placeholder="Select role"
                      />
                    </div> */}
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
                          {isCreating ? "Creating..." : "Create User"}
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
              <CardTitle>Team Members</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div>Loading...</div>
              ) : (
                <DataTable columns={columns} data={users} searchKey="email" />
              )}
            </CardContent>
          </Card>
        </div>
      </SidebarInset>

      <ConfirmModal
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={onConfirmDelete}
        title="Delete User"
        description="Are you sure you want to delete this user? This action cannot be undone."
        loading={isDeleting}
      />
    </SidebarProvider>
  );
}
