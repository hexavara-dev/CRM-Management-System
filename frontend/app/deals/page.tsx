"use client";

import { AppSidebar } from "@/components/Sidebar";
import { DealsPipelineTab } from "@/app/deals/components/deals-pipeline-tab";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { DataTable } from "@/components/ui/data-table";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDealsTable } from "@/hooks/use-deals-table";
import { formatRupiah } from "@/lib/helper";
import { Deal } from "@/types/deal";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export default function DealsPage() {
  const { deals, isLoading, deleteDeal, isDeleting, serverPagination } =
    useDealsTable();

  // const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  // const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [dealToDelete, setDealToDelete] = useState<string | null>(null);
  // const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  const router = useRouter();

  // const leadOptions = leads.map((lead) => ({
  //   value: lead.id,
  //   label: `${lead.customer.firstName} ${lead.customer.lastName || ""}`.trim(),
  // }));

  const columns = useMemo<ColumnDef<Deal>[]>(
    () => [
      {
        accessorKey: "refCode",
        header: "Ref Code",
        cell: ({ row }) => (
          <div
            className="flex cursor-pointer flex-col gap-1 hover:underline"
            onClick={() => router.push(`/deals/${row.original.id}`)}
          >
            <span className="font-medium text-blue-400">
              {row.getValue("refCode") || "N/A"}
            </span>
            {row.original.expectedClosingDate && (
              <span className="text-xs text-muted-foreground">
                Expected:{" "}
                {new Date(row.original.expectedClosingDate).toLocaleDateString(
                  "id-ID",
                )}
              </span>
            )}
          </div>
        ),
      },
      {
        id: "leadName",
        header: "Lead/Customer",
        accessorFn: (row) =>
          row.lead
            ? `${row.lead.customer.firstName} ${row.lead.customer.lastName || ""}`.trim()
            : "-",
      },
      {
        accessorKey: "lead.customer.location",
        header: "Unit",
      },
      {
        accessorKey: "expectedAmount",
        header: "Value",
        cell: ({ row }) => (
          <div className="font-medium">
            {formatRupiah(row.getValue("expectedAmount"))}
          </div>
        ),
      },
      // {
      //   accessorKey: "status",
      //   header: "Status",
      //   cell: ({ row }) => {
      //     const status = row.original.status?.name.toLowerCase() || "new";
      //     return (
      //       <span
      //         className={`rounded-full px-2 py-1 text-xs font-medium ${statusColors[status] || statusColors.new}`}
      //       >
      //         {status.charAt(0).toUpperCase() + status.slice(1)}
      //       </span>
      //     );
      //   },
      // },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const deal = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/deals/${deal.id}`);
                }}
              >
                <Eye className="h-4 w-4" />
              </Button>
              {/* <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(deal);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button> */}
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(deal.id);
                }}
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

  // const addForm = useForm<DealFormData>({
  //   resolver: zodResolver(dealFormSchema),
  //   defaultValues: {
  //     dealType: "",
  //     expectedAmount: 0,
  //     currency: "USD",
  //     expectedClosingDate: "",
  //     stageId: "",
  //     statusId: "",
  //     assignedUserId: "",
  //   },
  // });

  // const editForm = useForm<ConvertDealFormData>({
  //   resolver: zodResolver(convertDealSchema),
  //   defaultValues: {
  //     amount: 0,
  //   },
  // });

  // const onSubmitAdd = async (data: ConvertDealFormData) => {
  //   try {
  //     await createDeal({
  //       expectedAmount: data.expectedAmount,
  //       tenantId: user?.tenantId,
  //       assignedUserId: user?.id,
  //       leadId: selectedDeal?.lead?.id,
  //     });
  //     addForm.reset();
  //     setIsAddDialogOpen(false);
  //   } catch (error) {
  //     console.error("Failed to add deal:", error);
  //   }
  // };

  // const onSubmitEdit = async (data: DealFormData) => {
  //   if (selectedDeal) {
  //     try {
  //       await updateDeal({ id: selectedDeal.id, data });
  //       editForm.reset();
  //       setIsEditDialogOpen(false);
  //       setSelectedDeal(null);
  //     } catch (error) {
  //       console.error("Failed to update deal:", error);
  //     }
  //   }
  // };

  // const handleEdit = (deal: Deal) => {
  //   setSelectedDeal(deal);
  //   editForm.reset({
  //     amount: Number(deal.amount) || 0,
  //   });
  //   setIsEditDialogOpen(true);
  // };

  const handleDelete = (id: string) => {
    setDealToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const onConfirmDelete = async () => {
    if (dealToDelete) {
      try {
        await deleteDeal(dealToDelete);
        setIsDeleteDialogOpen(false);
        setDealToDelete(null);
      } catch (error) {
        console.error("Failed to delete deal:", error);
      }
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="w-0">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex flex-1 items-center justify-between">
            <h1 className="text-lg font-semibold">Deals</h1>
            {/* <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => addForm.reset()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Deal
                </Button>
              </DialogTrigger>
              <DialogContent className="min-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Deal</DialogTitle>
                  <DialogDescription>
                    Enter the deal information below.
                  </DialogDescription>
                </DialogHeader>
                <FormProvider {...addForm}>
                  <form
                    onSubmit={addForm.handleSubmit(onSubmitAdd)}
                    className="grid grid-cols-2 gap-4 py-4"
                  >
                    <FormInput
                      name="dealType"
                      label="Deal Type"
                      placeholder="e.g. Service, Product"
                      className="col-span-1"
                    />
                    <FormInput
                      name="expectedAmount"
                      label="Value"
                      type="number"
                      placeholder="0"
                      className="col-span-1"
                    />
                    <FormInput
                      name="expectedClosingDate"
                      label="Expected Close Date"
                      type="date"
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
                        <Button type="submit">Save Deal</Button>
                      </DialogFooter>
                    </div>
                  </form>
                </FormProvider>
              </DialogContent>
            </Dialog> */}
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4">
          <Tabs defaultValue="list" className="space-y-4">
            <TabsList>
              <TabsTrigger value="list">List Deals</TabsTrigger>
              <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Deals Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <DataTable
                    columns={columns}
                    data={deals}
                    searchKey="refCode"
                    isLoading={isLoading}
                    serverPagination={serverPagination}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pipeline" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Deals Pipeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <DealsPipelineTab />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </SidebarInset>

      {/* Edit Dialog */}
      {/* <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="min-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Deal</DialogTitle>
            <DialogDescription>
              Update the deal information below.
            </DialogDescription>
          </DialogHeader>
          <FormProvider {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(onSubmitEdit)}
              className="grid grid-cols-2 gap-4 py-4"
            >
              <FormInput
                name="dealType"
                label="Deal Type"
                placeholder="e.g. Service, Product"
                className="col-span-1"
              />
              <FormInput
                name="expectedAmount"
                label="Value"
                type="number"
                className="col-span-1"
              />
              <FormInput
                name="expectedClosingDate"
                label="Expected Close Date"
                type="date"
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
                  <Button type="submit">Save Changes</Button>
                </DialogFooter>
              </div>
            </form>
          </FormProvider>
        </DialogContent>
      </Dialog> */}

      <ConfirmModal
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={onConfirmDelete}
        title="Delete Deal"
        description="Are you sure you want to delete this deal? This action cannot be undone."
        loading={isDeleting}
      />
    </SidebarProvider>
  );
}
