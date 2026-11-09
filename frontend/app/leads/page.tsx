"use client";
import { AppSidebar } from "@/components/Sidebar";
import { LeadsPipelineTab } from "@/app/leads/components/leads-pipeline-tab";
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
import FormSelect from "@/components/ui/form-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLeadsTable } from "@/hooks/use-leads-table";
import { useLocations } from "@/hooks/use-locations";
import { useStatuses } from "@/hooks/use-statuses";
import { ConvertDealFormData } from "@/schemas/convert.schema";
import { LeadFormData, leadFormSchema } from "@/schemas/lead.schema";
import { Lead } from "@/types/lead";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth/auth-provider";
import Typography from "@/components/Typography";
import { useUsers } from "@/hooks/use-users";
import { useSources } from "@/hooks/use-sources";

export default function LeadsPage() {
  const {
    leads,
    isLoading,
    createLead,
    updateLead,
    deleteLead,
    convertToDeal,
    isDeleting,
    isConverting,
    serverPagination,
  } = useLeadsTable();
  const { user } = useAuth();

  const { statuses } = useStatuses({
    additionalParams: {
      type: "lead",
    },
  });
  const { locations } = useLocations();
  const { users } = useUsers();
  const { sources } = useSources({
    additionalParams: {
      type: "lead",
    },
  });

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [leadToDelete, setLeadToDelete] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const router = useRouter();

  const handleDelete = useCallback((id: string) => {
    setLeadToDelete(id);
    setIsDeleteDialogOpen(true);
  }, []);

  const columns = useMemo<ColumnDef<Lead>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        accessorFn: (row) =>
          `${row.customer.firstName} ${row.customer.lastName || ""}`.trim(),
        cell: ({ row }) => {
          const lead = row.original;
          const name = row.getValue("name") as string;
          return (
            <div
              className="flex cursor-pointer flex-col gap-1 hover:underline"
              onClick={() => router.push(`/leads/${lead.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  router.push(`/leads/${lead.id}`);
                }
              }}
            >
              <span className="font-medium text-blue-400">{name}</span>
              <span className="text-xs text-muted-foreground">
                {lead.customer.email}
              </span>
            </div>
          );
        },
      },
      {
        id: "company",
        header: "Company",
        accessorFn: (row) => row.customer.organization?.name || "-",
      },
      {
        accessorKey: "location.name",
        header: "Unit",
        accessorFn: (row) => row.location?.name || "-",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          return (
            <Badge colorHex={row.original.status?.color || "#E0E0E0"}>
              {row.original.status?.name || "-"}
            </Badge>
          );
        },
      },
      {
        header: "Sales",
        cell: ({ row }) => {
          return (
            <Typography color="black">
              {row.original.assignedUser?.name || "-"}
            </Typography>
          );
        },
      },
      {
        id: "phone",
        header: "Phone",
        accessorFn: (row) => row.customer.phoneNumber || "-",
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const lead = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              {/* {!lead.converted && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenConvert(lead);
                  }}
                  title="Convert to Deal"
                >
                  <ArrowRight className="h-4 w-4 text-green-500" />
                </Button>
              )} */}
              {/* <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(lead);
                }}
                title="Edit Lead"
              >
                <Pencil className="h-4 w-4 text-blue-500" />
              </Button> */}
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(lead.id);
                }}
                title="Delete Lead"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          );
        },
      },
    ],
    [router, handleDelete],
  );

  const locationOptions = useMemo(
    () =>
      locations.map((location) => ({
        value: location.id,
        label: location.name,
      })),
    [locations],
  );

  const getLocationNameById = (locationId?: string) => {
    if (!locationId) return "";
    return locations.find((location) => location.id === locationId)?.name || "";
  };

  const addForm = useForm<LeadFormData>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      statusId: "",
      source: "",
      gender: "",
      salutation: "",
      organizationName: "",
      organizationLocation: "",
      locationId: "",
      assignedUserId: "",
      sourceId: "",
    },
  });

  const editForm = useForm<LeadFormData>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      statusId: "",
      source: "",
      gender: "",
      salutation: "",
      organizationName: "",
      organizationLocation: "",
      locationId: "",
      sourceId: "",
    },
  });

  const convertForm = useForm({
    defaultValues: {
      expectedAmount: 0,
      currency: "USD",
    },
  });

  const onSubmitAdd = async (data: LeadFormData) => {
    try {
      await createLead({
        ...data,
        sourceUserId: user?.id,
        location: getLocationNameById(data.locationId),
        assignedUserId:
          user?.role === "owner"
            ? data.assignedUserId || user.id
            : user?.id,
      });
      addForm.reset();
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error("Failed to add lead:", error);
    }
  };

  const onSubmitEdit = async (data: LeadFormData) => {
    if (selectedLead) {
      try {
        await updateLead({
          id: selectedLead.id,
          data: {
            ...data,
            location: getLocationNameById(data.locationId),
          },
        });
        editForm.reset();
        setIsEditDialogOpen(false);
        setSelectedLead(null);
      } catch (error) {
        console.error("Failed to update lead:", error);
      }
    }
  };

  const onSubmitConvert = async (data: ConvertDealFormData) => {
    if (selectedLead) {
      try {
        await convertToDeal({
          id: selectedLead.id,
          dealData: data,
        });
        setIsConvertDialogOpen(false);
        setSelectedLead(null);
      } catch (error) {
        console.error("Failed to convert lead:", error);
      }
    }
  };

  // const handleEdit = (lead: Lead) => {
  //   setSelectedLead(lead);
  //   editForm.reset({
  //     salutation: lead.customer.salutation || "",
  //     gender: lead.customer.gender || "",
  //     firstName: lead.customer.firstName,
  //     lastName: lead.customer.lastName || "",
  //     email: lead.customer.email || "",
  //     phone: lead.customer.phoneNumber || "",
  //     organizationName: lead.customer.organization?.name || "",
  //     organizationLocation: lead.customer.organization?.location || "",
  //     locationId:
  //       lead.locationId || getLocationIdByName(lead.customer.location || ""),
  //     company: lead.customer.organization?.name || "",
  //     statusId: lead.status?.id || "",
  //     source: lead.type || "",
  //     notes: "",
  //   });
  //   setIsEditDialogOpen(true);
  // };

  // const handleOpenConvert = (lead: Lead) => {
  //   setSelectedLead(lead);
  //   convertForm.reset({
  //     expectedAmount: 0,
  //     currency: "USD",
  //   });
  //   setIsConvertDialogOpen(true);
  // };

  const onConfirmDelete = async () => {
    if (leadToDelete) {
      try {
        await deleteLead(leadToDelete);
        setIsDeleteDialogOpen(false);
        setLeadToDelete(null);
      } catch (error) {
        console.error("Failed to delete lead:", error);
      }
    }
  };

  return (
    <SidebarProvider className="overflow-hidden">
      <AppSidebar />
      <SidebarInset className="w-0">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex flex-1 items-center justify-between">
            <h1 className="text-lg font-semibold">Leads</h1>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => addForm.reset()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Lead
                </Button>
              </DialogTrigger>
              <DialogContent className="min-w-5xl">
                <DialogHeader>
                  <DialogTitle>Add New Lead</DialogTitle>
                  <DialogDescription>
                    Enter the lead information below.
                  </DialogDescription>
                </DialogHeader>
                <FormProvider {...addForm}>
                  <form
                    onSubmit={addForm.handleSubmit(onSubmitAdd)}
                    className="grid grid-cols-2 gap-4"
                  >
                    <div className="grid grid-cols-2 gap-4 h-max">
                      <div className="border-b pb-1.5 col-span-2">
                        <Typography as="h3" weight="medium" color="black">
                          Biodata
                        </Typography>
                      </div>
                      <FormSelect
                        name="salutation"
                        label="Salutation"
                        options={[
                          { value: "Mr", label: "Mr" },
                          { value: "Mrs", label: "Mrs" },
                          { value: "Ms", label: "Ms" },
                          { value: "Dr", label: "Dr" },
                        ]}
                        placeholder="Select"
                        className="col-span-1"
                      />
                      <FormSelect
                        name="gender"
                        label="Gender"
                        options={[
                          { value: "male", label: "Male" },
                          { value: "female", label: "Female" },
                        ]}
                        placeholder="Select"
                        className="col-span-1"
                      />
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
                    </div>

                    <div className="grid grid-cols-2 gap-4 h-max">
                      <div className="border-b pb-1.5 col-span-2">
                        <Typography as="h3" weight="medium" color="black">
                          Contacts
                        </Typography>
                      </div>
                      <FormInput
                        name="email"
                        label="Email"
                        type="email"
                        placeholder="email@example.com"
                        className="col-span-1"
                      />
                      <FormInput
                        name="phone"
                        label="Phone"
                        placeholder="+62 xxx xxxx xxxx"
                        className="col-span-1"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 h-max">
                      <div className="border-b pb-1.5 col-span-2">
                        <Typography as="h3" weight="medium" color="black">
                          Organizations (Optional)
                        </Typography>
                      </div>
                      <FormInput
                        name="organizationName"
                        label="Organization Name"
                        placeholder="Company Name"
                        className="col-span-1"
                      />
                      <FormInput
                        name="organizationLocation"
                        label="Organization Location"
                        placeholder="Input Adress"
                        className="col-span-1"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 h-max">
                      <div className="border-b pb-1.5 col-span-2">
                        <Typography as="h3" weight="medium" color="black">
                          Additional Info
                        </Typography>
                      </div>
                      <FormSelect
                        name="locationId"
                        label="Unit"
                        placeholder="Select location"
                        className="col-span-1"
                        options={locationOptions}
                        disabled={locationOptions.length === 0}
                      />

                      {user?.role === "owner" && (
                        <FormSelect
                          name="assignedUserId"
                          label="Assigned Sales"
                          placeholder="Select sales"
                          className="col-span-1"
                          options={users.map((u) => ({
                            value: u.id,
                            label: u.name,
                          }))}
                          disabled={users.length === 0}
                        />
                      )}

                      <FormSelect
                        name="statusId"
                        label="Status"
                        className="col-span-1"
                        options={statuses.map((s) => ({
                          value: s.id,
                          label: s.name,
                        }))}
                        placeholder="Select status"
                        disabled={statuses.length === 0}
                      />
                      <FormSelect
                        name="sourceId"
                        label="Source"
                        placeholder="Select source"
                        className="col-span-1"
                        options={sources.map((s) => ({
                          value: s.id,
                          label: s.name,
                        }))}
                        disabled={sources.length === 0}
                      />
                      {/* <div className="col-span-2">
                        <FormTextarea
                          name="notes"
                          label="Notes"
                          placeholder="Additional notes..."
                          rows={3}
                        />
                      </div> */}
                    </div>
                    <div className="col-span-2">
                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsAddDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit">Save Lead</Button>
                      </DialogFooter>
                    </div>
                  </form>
                </FormProvider>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        <div className="p-4">
          <Tabs defaultValue="list" className="space-y-4">
            <TabsList>
              <TabsTrigger value="list">List Leads</TabsTrigger>
              <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Leads Management</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div>Loading leads...</div>
                  ) : (
                    <DataTable
                      columns={columns}
                      data={leads}
                      searchKey="name"
                      serverPagination={serverPagination}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pipeline">
              <Card>
                <CardHeader>
                  <CardTitle>Leads Pipeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <LeadsPipelineTab />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </SidebarInset>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="min-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Lead</DialogTitle>
            <DialogDescription>
              Update the lead information below.
            </DialogDescription>
          </DialogHeader>
          <FormProvider {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(onSubmitEdit)}
              className="grid grid-cols-2 gap-4"
            >
              <FormSelect
                name="salutation"
                label="Salutation"
                options={[
                  { value: "Mr", label: "Mr" },
                  { value: "Mrs", label: "Mrs" },
                  { value: "Ms", label: "Ms" },
                  { value: "Dr", label: "Dr" },
                ]}
                placeholder="Select"
                className="col-span-1"
              />
              <FormSelect
                name="gender"
                label="Gender"
                options={[
                  { value: "male", label: "Male" },
                  { value: "female", label: "Female" },
                ]}
                placeholder="Select"
                className="col-span-1"
              />
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
              <FormInput name="phone" label="Phone" className="col-span-1" />
              <FormInput
                name="organizationName"
                label="Organization Name"
                className="col-span-1"
              />
              <FormInput
                name="organizationLocation"
                label="Organization Location"
                className="col-span-1"
              />
              <FormSelect
                name="locationId"
                label="Contact Location"
                className="col-span-1"
                placeholder="Select location"
                options={locationOptions}
                disabled={locationOptions.length === 0}
              />
              <FormInput
                name="company"
                label="Company (Alias)"
                className="col-span-1"
              />
              <FormSelect
                name="statusName"
                label="Status"
                className="col-span-1"
                options={statuses.map((s) => ({
                  value: s.name,
                  label: s.name,
                }))}
                placeholder="Select status"
              />
              <FormInput name="source" label="Source" className="col-span-1" />
              <div className="col-span-2">
                <FormTextarea name="notes" label="Notes" rows={3} />
              </div>
              <div className="col-span-2">
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Save Changes</Button>
                </DialogFooter>
              </div>
            </form>
          </FormProvider>
        </DialogContent>
      </Dialog>

      {/* Convert Dialog */}
      <Dialog open={isConvertDialogOpen} onOpenChange={setIsConvertDialogOpen}>
        <DialogContent className="min-w-2xl">
          <DialogHeader>
            <DialogTitle>Convert to Deal</DialogTitle>
            <DialogDescription>
              Convert this lead into an active deal.
            </DialogDescription>
          </DialogHeader>
          <FormProvider {...convertForm}>
            <form
              onSubmit={convertForm.handleSubmit(onSubmitConvert)}
              className="grid gap-4 py-4"
            >
              <FormInput
                name="expectedAmount"
                label="Expected Amount"
                type="number"
              />
              <FormInput name="currency" label="Currency" />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsConvertDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isConverting}>
                  {isConverting ? "Converting..." : "Convert to Deal"}
                </Button>
              </DialogFooter>
            </form>
          </FormProvider>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={onConfirmDelete}
        title="Delete Lead"
        description="Are you sure you want to delete this lead? This action cannot be undone."
        loading={isDeleting}
      />
    </SidebarProvider>
  );
}
