"use client";

import { AppSidebar } from "@/components/Sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useNotes } from "@/hooks/use-notes";
import { Link2, Search, StickyNote, Trash2 } from "lucide-react";
import { useState } from "react";

// type LeadActivity = {
//   id: string;
//   leadId: string;
//   createdAt?: string;
// };

// type DealActivity = {
//   id: string;
//   dealId: string;
//   createdAt?: string;
// };

// type DisplayNote = ApiNote & {
//   entityType: "lead" | "deal";
//   entityId: string;
//   createdAt?: string;
// };

export default function NotesPage() {
  const {
    notes,
    // updateNote,
    deleteNote,
    isLoading: isNotesLoading,
  } = useNotes();
  const [searchQuery, setSearchQuery] = useState("");
  // const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  // const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  // const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  // const { data: leadActivities } = useQuery<ApiResponse<LeadActivity[]>>({
  //   queryKey: ["leadActivities"],
  //   queryFn: async () => {
  //     const response = await api.get("/api/leadactivity");
  //     return response.data;
  //   },
  // });

  // const { data: dealActivities } = useQuery<ApiResponse<DealActivity[]>>({
  //   queryKey: ["dealActivities"],
  //   queryFn: async () => {
  //     const response = await api.get("/api/dealactivity");
  //     return response.data;
  //   },
  // });

  // const leadActivityMap = new Map(leadActivities?.data.map((a) => [a.id, a]));
  // const dealActivityMap = new Map(dealActivities?.data.map((a) => [a.id, a]));

  // const displayNotes: DisplayNote[] | undefined = notes?.reduce<DisplayNote[]>(
  //   (acc, note) => {
  //     if (note.leadActivityId) {
  //       const activity = leadActivityMap.get(note.leadActivityId);
  //       if (activity) {
  //         acc.push({
  //           ...note,
  //           entityType: "lead",
  //           entityId: activity.leadId,
  //           createdAt: activity.createdAt,
  //         });
  //       }
  //       return acc;
  //     }

  //     if (note.dealActivityId) {
  //       const activity = dealActivityMap.get(note.dealActivityId);
  //       if (activity) {
  //         acc.push({
  //           ...note,
  //           entityType: "deal",
  //           entityId: activity.dealId,
  //           createdAt: activity.createdAt,
  //         });
  //       }
  //     }

  //     return acc;
  //   },
  //   [],
  // );

  // const filteredNotes = displayNotes?.filter((note) => {
  //   const contentMatch = note.content
  //     .toLowerCase()
  //     .includes(searchQuery.toLowerCase());
  //   const entityMatch = getEntityName(note.entityType, note.entityId)
  //     .toLowerCase()
  //     .includes(searchQuery.toLowerCase());
  //   return contentMatch || entityMatch;
  // });

  // const addForm = useForm<NoteFormData>({
  //   defaultValues: {
  //     content: "",
  //     entityType: "lead",
  //     entityId: "",
  //   },
  // });

  // const createActivityForEntity = async (data: NoteFormData) => {
  //   if (data.entityType === "lead") {
  //     const response = await api.post<LeadActivity>("/api/leadactivity", {
  //       leadId: data.entityId,
  //       activityType: "note",
  //     });

  //     return {
  //       leadActivityId: response.data.id,
  //     };
  //   }

  //   const response = await api.post<DealActivity>("/api/dealactivity", {
  //     dealId: data.entityId,
  //     activityType: "note",
  //   });

  //   return {
  //     dealActivityId: response.data.id,
  //   };
  // };

  // const onSubmitAdd = async (data: NoteFormData) => {
  //   if (!data.entityId) return;
  //   const activityReference = await createActivityForEntity(data);
  //   await createNote({
  //     content: data.content,
  //     ...activityReference,
  //   });
  //   addForm.reset();
  //   setIsAddDialogOpen(false);
  // };

  // const onSubmitEdit = async (data: NoteFormData) => {
  //   if (selectedNote && data.entityId) {
  //     const entityChanged =
  //       selectedNote.entityType !== data.entityType ||
  //       selectedNote.entityId !== data.entityId;

  //     if (entityChanged) {
  //       const activityReference = await createActivityForEntity(data);
  //       await updateNote({
  //         id: selectedNote.id,
  //         data: {
  //           content: data.content,
  //           leadActivityId: activityReference.leadActivityId,
  //           dealActivityId: activityReference.dealActivityId,
  //         },
  //       });
  //     } else {
  //       await updateNote({
  //         id: selectedNote.id,
  //         data: {
  //           content: data.content,
  //         },
  //       });
  //     }

  //     editForm.reset();
  //     setIsEditDialogOpen(false);
  //     setSelectedNote(null);
  //   }
  // };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this note?")) {
      await deleteNote(id);
    }
  };

  // const openEditDialog = (note: DisplayNote) => {
  //   setSelectedNote(note);
  //   editForm.reset({
  //     content: note.content,
  //     entityType: note.entityType,
  //     entityId: note.entityId,
  //   });
  //   setIsEditDialogOpen(true);
  // };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-8 !self-center" />
          <div className="flex flex-1 items-center justify-between">
            <h1 className="text-lg font-semibold">Notes</h1>
            {/* <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => addForm.reset()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Note
                </Button>
              </DialogTrigger>
              <DialogContent className="min-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Note</DialogTitle>
                  <DialogDescription>
                    Create a note for a lead or deal.
                  </DialogDescription>
                </DialogHeader>
                <FormProvider {...addForm}>
                  <form
                    onSubmit={addForm.handleSubmit(onSubmitAdd)}
                    className="grid grid-cols-2 gap-4 py-4"
                  >
                    <FormSelect
                      name="entityType"
                      label="Related To"
                      options={entityTypeOptions}
                      placeholder="Select entity type"
                      className="col-span-1"
                    />
                    <FormSelect
                      name="entityId"
                      label={
                        addForm.watch("entityType") === "lead" ? "Lead" : "Deal"
                      }
                      options={getEntityOptions(addForm.watch("entityType"))}
                      placeholder="Select entity"
                      validation={{ required: "Entity is required" }}
                      className="col-span-1"
                    />
                    <FormTextarea
                      name="content"
                      label="Note Content"
                      validation={{ required: "Content is required" }}
                      placeholder="Write your note here..."
                      rows={5}
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
                        <Button type="submit">Save Note</Button>
                      </DialogFooter>
                    </div>
                  </form>
                </FormProvider>
              </DialogContent>
            </Dialog> */}
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-6">
          {isNotesLoading ? (
            <div className="text-sm text-muted-foreground text-center h-screen flex items-center justify-center">
              Loading notes...
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search notes or related entities..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  {notes?.length} notes found
                </div>
              </div>
              {notes?.length === 0 ? (
                <div className="flex h-100 flex-col items-center justify-center rounded-lg border-2 border-dashed">
                  <StickyNote className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                  <p className="text-muted-foreground">No notes found.</p>
                  {searchQuery && (
                    <Button
                      variant="link"
                      onClick={() => setSearchQuery("")}
                      className="mt-2"
                    >
                      Clear search
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {notes?.map((note) => (
                    <Card key={note.id} className="flex flex-col group h-fit">
                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <Badge
                            variant="secondary"
                            className={
                              note.leadActivityId
                                ? "bg-blue-100 text-blue-700 hover:bg-blue-100"
                                : "bg-green-100 text-green-700 hover:bg-green-100"
                            }
                          >
                            {note.leadActivityId ? "Lead" : "Deal"}
                          </Badge>
                          {/* <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {note.
                              ? new Date(note.createdAt).toLocaleDateString(
                                  "id-ID",
                                )
                              : "-"}
                          </span> */}
                        </div>
                        <div className="flex items-center gap-1.5 mt-2 text-sm font-medium text-muted-foreground overflow-hidden">
                          <Link2 className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            {note.leadActivity
                              ? note.leadActivity?.lead?.customer?.firstName +
                                " " +
                                note.leadActivity?.lead?.customer?.lastName
                              : note.dealActivity?.deal?.lead?.customer
                                  ?.firstName +
                                " " +
                                note.dealActivity?.deal.lead?.customer
                                  ?.lastName}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-2 flex-1">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                          {note.content}
                        </p>
                      </CardContent>
                      <CardFooter className="p-2 border-t flex justify-end gap-1 bg-muted/30 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(note)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button> */}
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(note.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </SidebarInset>

      {/* Edit Dialog */}
      {/* <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="min-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Note</DialogTitle>
            <DialogDescription>Update the note below.</DialogDescription>
          </DialogHeader>
          <FormProvider {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(onSubmitEdit)}
              className="grid gap-4 py-4"
            >
              <FormSelect
                name="entityType"
                label="Related To"
                options={entityTypeOptions}
                placeholder="Select entity type"
              />
              <FormSelect
                name="entityId"
                label={
                  editForm.watch("entityType") === "lead" ? "Lead" : "Deal"
                }
                options={getEntityOptions(editForm.watch("entityType"))}
                placeholder="Select entity"
                validation={{ required: "Entity is required" }}
              />
              <FormTextarea
                name="content"
                label="Note Content"
                validation={{ required: "Content is required" }}
                rows={5}
              />
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
            </form>
          </FormProvider>
        </DialogContent>
      </Dialog> */}
    </SidebarProvider>
  );
}
