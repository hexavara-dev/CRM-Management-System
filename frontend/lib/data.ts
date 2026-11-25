export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "hot"
  | "warm"
  | "cold"
  | "converted"
  | "lost";

export type DealStatus =
  | "new"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost"
  | "closed";

export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  status: LeadStatus;
  source?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Deal {
  id: string;
  name: string;
  value: number;
  status: DealStatus;
  leadId?: string;
  leadName?: string;
  expectedCloseDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  role?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  territory: string;
  website?: string;
  industry: string;
  address: string;
  numberOfEmployees: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Note {
  id: string;
  content: string;
  entityType: "lead" | "deal";
  entityId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: Date;
  status: TaskStatus;
  entityType?: "lead" | "deal";
  entityId?: string;
  priority: "low" | "normal" | "high" | "urgent";
  assignedUserId?: string;
  assignedUser?: {
    id: string;
    name: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Activity {
  id: string;
  type: "call" | "email" | "comment" | "meeting" | "note";
  description: string;
  entityType: "lead" | "deal";
  entityId: string;
  createdAt: Date;
}

export interface CallLog {
  id: string;
  entityType: "lead" | "deal";
  entityId: string;
  leadId?: string;
  type: "incoming" | "outgoing";
  status: "completed" | "missed" | "voicemail";
  duration?: number;
  notes?: string;
  createdAt: Date;
}

export interface Attachment {
  id: string;
  entityType: "lead" | "deal";
  entityId: string;
  leadId?: string;
  name: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedAt: Date;
  /** Nama user terautentikasi yang mengunggah (dari backend). */
  uploadedByName?: string;
  /** Aktivitas Lead yang menjadi asal dokumen, mis. "Visit / Survey · 25 Nov 2026". */
  activityLabel?: string;
}

export const initialLeads: Lead[] = [
  {
    id: "1",
    name: "Budi Santoso",
    email: "budi.santoso@agungjay.co.id",
    phone: "+62 812 3456 7890",
    company: "PT Agung Jaya",
    status: "hot",
    source: "Website",
    notes: "Interested in construction materials",
    createdAt: new Date("2026-02-15"),
    updatedAt: new Date("2026-03-01"),
  },
  {
    id: "2",
    name: "Siti Rahayu",
    email: "siti.rahayu@berkahsejahtera.com",
    phone: "+62 821 5678 9012",
    company: "CV Berkah Sejahtera",
    status: "warm",
    source: "Referral",
    notes: "Looking for partnership opportunity",
    createdAt: new Date("2026-02-20"),
    updatedAt: new Date("2026-03-05"),
  },
  {
    id: "3",
    name: "Ahmad Wijaya",
    email: "ahmad.wijaya@majubangunan.id",
    phone: "+62 856 7890 1234",
    company: "Toko Bangunan Maju",
    status: "cold",
    source: "Cold Call",
    createdAt: new Date("2026-03-01"),
    updatedAt: new Date("2026-03-01"),
  },
  {
    id: "4",
    name: "Dewi Kusuma",
    email: "dewi.kusuma@sumberrejeki.co.id",
    phone: "+62 878 9012 3456",
    company: "PT Sumber Rejeki",
    status: "qualified",
    source: "Trade Show",
    notes: "Big potential client",
    createdAt: new Date("2026-02-10"),
    updatedAt: new Date("2026-03-08"),
  },
  {
    id: "5",
    name: "Rina Permata",
    email: "rina.permata@indokonstruksi.com",
    phone: "+62 895 6789 0123",
    company: "CV Indo Konstruksi",
    status: "new",
    source: "Website",
    createdAt: new Date("2026-03-08"),
    updatedAt: new Date("2026-03-08"),
  },
];

export const initialDeals: Deal[] = [
  {
    id: "1",
    name: "Project Renovasi Kantor",
    value: 150000000,
    status: "won",
    leadId: "1",
    leadName: "Budi Santoso",
    expectedCloseDate: new Date("2026-02-28"),
    notes: "Renovation project for office building",
    createdAt: new Date("2026-01-15"),
    updatedAt: new Date("2026-02-28"),
    closedAt: new Date("2026-02-28"),
  },
  {
    id: "2",
    name: "Supply Material Bangunan",
    value: 75000000,
    status: "negotiation",
    leadId: "2",
    leadName: "Siti Rahayu",
    expectedCloseDate: new Date("2026-03-15"),
    createdAt: new Date("2026-02-01"),
    updatedAt: new Date("2026-03-05"),
  },
  {
    id: "3",
    name: "Pemasangan Alumunium",
    value: 45000000,
    status: "proposal",
    leadId: "4",
    leadName: "Dewi Kusuma",
    expectedCloseDate: new Date("2026-03-20"),
    createdAt: new Date("2026-02-20"),
    updatedAt: new Date("2026-03-08"),
  },
  {
    id: "4",
    name: "Jasa Konsultasi Proyek",
    value: 25000000,
    status: "new",
    expectedCloseDate: new Date("2026-04-01"),
    createdAt: new Date("2026-03-07"),
    updatedAt: new Date("2026-03-07"),
  },
  {
    id: "5",
    name: "Pembangunan Gudang",
    value: 200000000,
    status: "lost",
    expectedCloseDate: new Date("2026-01-31"),
    notes: "Lost to competitor",
    createdAt: new Date("2025-12-15"),
    updatedAt: new Date("2026-01-31"),
    closedAt: new Date("2026-01-31"),
  },
];

export const initialContacts: Contact[] = [
  {
    id: "1",
    name: "Budi Santoso",
    email: "budi@agungjay.co.id",
    phone: "+62 812 3456 7890",
    company: "PT Agung Jaya",
    role: "Project Manager",
    notes: "Main contact person",
    createdAt: new Date("2026-02-15"),
    updatedAt: new Date("2026-03-01"),
  },
  {
    id: "2",
    name: "Siti Rahayu",
    email: "siti@berkahsejahtera.com",
    phone: "+62 821 5678 9012",
    company: "CV Berkah Sejahtera",
    role: "Owner",
    createdAt: new Date("2026-02-20"),
    updatedAt: new Date("2026-03-05"),
  },
  {
    id: "3",
    name: "Ahmad Wijaya",
    email: "ahmad@sumberrejeki.co.id",
    phone: "+62 878 9012 3456",
    company: "PT Sumber Rejeki",
    role: "Director",
    createdAt: new Date("2026-02-10"),
    updatedAt: new Date("2026-03-08"),
  },
];

export const initialOrganizations: Organization[] = [
  {
    id: "1",
    name: "PT Agung Jaya",
    territory: "Jakarta",
    website: "https://agungjaya.co.id",
    industry: "Construction",
    address: "Jl. Sudirman No. 123, Jakarta Selatan",
    numberOfEmployees: 180,
    createdAt: new Date("2026-01-20"),
    updatedAt: new Date("2026-03-01"),
  },
  {
    id: "2",
    name: "CV Berkah Sejahtera",
    territory: "Bandung",
    website: "https://berkahsejahtera.com",
    industry: "Building Materials",
    address: "Jl. Asia Afrika No. 45, Bandung",
    numberOfEmployees: 72,
    createdAt: new Date("2026-01-24"),
    updatedAt: new Date("2026-03-05"),
  },
  {
    id: "3",
    name: "PT Sumber Rejeki",
    territory: "Surabaya",
    website: "https://sumberrejeki.co.id",
    industry: "Real Estate",
    address: "Jl. Pemuda No. 78, Surabaya",
    numberOfEmployees: 240,
    createdAt: new Date("2026-01-12"),
    updatedAt: new Date("2026-03-08"),
  },
  {
    id: "4",
    name: "CV Indo Konstruksi",
    territory: "Yogyakarta",
    website: "https://indokonstruksi.com",
    industry: "Engineering Services",
    address: "Jl. Malioboro No. 21, Yogyakarta",
    numberOfEmployees: 54,
    createdAt: new Date("2026-02-08"),
    updatedAt: new Date("2026-03-08"),
  },
];

export const initialNotes: Note[] = [
  {
    id: "1",
    content: "Client requested quote for 500 bags of cement",
    entityType: "lead",
    entityId: "1",
    createdAt: new Date("2026-02-16"),
    updatedAt: new Date("2026-02-16"),
  },
  {
    id: "2",
    content: "Follow up next week for decision",
    entityType: "deal",
    entityId: "2",
    createdAt: new Date("2026-03-05"),
    updatedAt: new Date("2026-03-05"),
  },
];

export const initialTasks: Task[] = [
  {
    id: "1",
    title: "Follow up with PT Agung Jaya",
    description: "Call to confirm project timeline",
    dueDate: new Date("2026-03-10"),
    status: "pending",
    priority: "high",
    entityType: "lead",
    entityId: "1",
    createdAt: new Date("2026-03-08"),
    updatedAt: new Date("2026-03-08"),
  },
  {
    id: "2",
    title: "Send proposal to CV Berkah Sejahtera",
    description: "Prepare quotation document",
    dueDate: new Date("2026-03-12"),
    status: "in_progress",
    priority: "normal",
    entityType: "deal",
    entityId: "2",
    createdAt: new Date("2026-03-06"),
    updatedAt: new Date("2026-03-07"),
  },
  {
    id: "3",
    title: "Meeting with PT Sumber Rejeki",
    description: "Site visit discussion",
    dueDate: new Date("2026-03-15"),
    status: "pending",
    priority: "normal",
    entityType: "deal",
    entityId: "3",
    createdAt: new Date("2026-03-08"),
    updatedAt: new Date("2026-03-08"),
  },
];

export const initialActivities: Activity[] = [
  {
    id: "1",
    type: "call",
    description: "Called to discuss project requirements",
    entityType: "lead",
    entityId: "1",
    createdAt: new Date("2026-03-01"),
  },
  {
    id: "2",
    type: "email",
    description: "Sent price quotation",
    entityType: "deal",
    entityId: "2",
    createdAt: new Date("2026-03-04"),
  },
  {
    id: "3",
    type: "comment",
    description: "Client requested additional discount",
    entityType: "deal",
    entityId: "2",
    createdAt: new Date("2026-03-05"),
  },
];

export const initialCallLogs: CallLog[] = [
  {
    id: "1",
    entityType: "lead",
    entityId: "1",
    leadId: "1",
    type: "outgoing",
    status: "completed",
    duration: 342,
    notes: "Discussed project timeline and requirements",
    createdAt: new Date("2026-03-01T10:30:00"),
  },
  {
    id: "2",
    entityType: "lead",
    entityId: "1",
    leadId: "1",
    type: "incoming",
    status: "missed",
    notes: "Missed call - client called back later",
    createdAt: new Date("2026-03-02T14:15:00"),
  },
  {
    id: "3",
    entityType: "lead",
    entityId: "1",
    leadId: "1",
    type: "outgoing",
    status: "completed",
    duration: 180,
    notes: "Follow-up call about quote",
    createdAt: new Date("2026-03-05T09:00:00"),
  },
];

export const initialAttachments: Attachment[] = [
  {
    id: "1",
    entityType: "lead",
    entityId: "1",
    leadId: "1",
    name: "Price Quotation - PT Agung Jaya.pdf",
    fileUrl: "/attachments/quotation-1.pdf",
    fileType: "application/pdf",
    fileSize: 245000,
    uploadedAt: new Date("2026-03-01"),
  },
  {
    id: "2",
    entityType: "lead",
    entityId: "1",
    leadId: "1",
    name: "Meeting Notes - 28 Feb 2026.docx",
    fileUrl: "/attachments/meeting-notes.docx",
    fileType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    fileSize: 52000,
    uploadedAt: new Date("2026-02-28"),
  },
];
