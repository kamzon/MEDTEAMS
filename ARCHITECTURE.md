# Architecture

## Part 1: Unified Use Cases & Workflow Matrices

To achieve a "Microsoft Teams" style workspace, the application relies on an internal event loop. The system manages two main user roles: the Secretary (Administrative Desk) and the Doctor (Clinical Cockpit).

```text
[ Patient Arrives ] 
       │
       ▼
 ┌───────────┐      Encrypted Local SQLite      ┌───────────┐
 │ Secretary │ ───────────────────────────────> │  Doctor   │
 └───────────┘    State Synced via IPC Events   └───────────┘
   Scans QR /       Updates Waiting Room Line      Sees Visual Alert;
   Triage Input                                    Opens Clinical Workspace
```

### Use Case 1: Patient Admission & Queue Triage (Zero-Paper Onboarding)

Actors: Secretary, Patient.

Preconditions: System is online locally; SQLite database is mounted.

Workflow:

Patient arrives at the cabinet and presents an AMO card, identity document, or a digital QR code containing their national health profile.

The Secretary clicks "Scan QR/Identity" within the Triage Hub. The local camera stream resolves the identity fields.

The system executes a search query against the local patients database table.

If found: Populates the screen with existing history, allergies, and insurance categorization (AMO-Achamil, AMO-Tadamon, or CNSS-Private).

If not found: Opens a minimal registration overlay with validation fields matching Moroccan civil data structures.

The Secretary assigns a dynamic check-in status: waiting. This appends the patient to the current day's active queue file with an initial timestamp (checked_in_at).

### Use Case 2: The Longitudinal Patient Workspace (The Clinical Channel)

Actors: Doctor.

Preconditions: Patient status set to waiting or actively selected via Search Directory.

Workflow:

The Doctor views a live counter displaying patients currently in the waiting room.

The Doctor clicks "Admit Patient" on the highest-priority patient card. This instantly alters the patient state to in_exam via a fast database mutation.

The application switches to the central patient view. This screen acts like a unified workspace channel containing:

Left Column (Historical Feed): A scrollable timeline of past clinical notes, old diagnoses, and previous prescription documents.

Center Column (Interactive Charting): A medical text compiler pre-filled with structural SOAP (Subjective, Objective, Assessment, Plan) placeholders, alongside a canvas to view chronic vitals charts.

Right Column (File Cabinet): A visual drag-and-drop landing area where uploaded medical PDFs, laboratory outputs, and imaging reports are rendered inline.

### Use Case 3: The Structured Consultation & Prescribing Session

Actors: Doctor.

Preconditions: Active consultation file opened inside the Clinical Channel.

Workflow:

The Doctor speaks or types medical statements. If utilizing the Med-Darija Audio Scribe, the spoken Moroccan Darija is parsed locally or via a stream, outputting a structured French SOAP text block into the workspace.

The Doctor transitions to the Prescription sub-module. When adding a drug entry, an autocompletion index pulls names and standard dosages directly from a preloaded local database of Moroccan therapeutics.

The Doctor marks the consultation as complete:

The system executes an atomic transaction saving the notes, compiling the prescription into a structured schema, and updating the patient status to billing.

The system generates a secure, unique 2026 Moroccan FSE (Feuille de Soins Électronique) QR Code embedding the relevant CNSS/AMO procedure codes.

### Use Case 4: Collaborative Syncing (Doctor-Secretary Internal Interface)

Actors: Doctor, Secretary.

Preconditions: Both app instances share the same local SQLite file system path.

Workflow:

As soon as the Doctor saves a consultation record, the system fires an internal event.

The Secretary's desktop terminal receives an asynchronous signal, refreshing the active billing ledger.

The Secretary views the patient profile in the billing view, verifies the generated FSE QR code, processes payment collection, prints out physical certification documents if requested by the patient, and updates the state to completed.

## Part 2: Technical Architecture & System Topography

The platform is designed around a Local-First Desktop App architecture using Tauri. Tauri leverages a dual-process architecture: a native Rust runtime manages system calls, file access, and database interactions, while a Chromium/WebKit webview renders the interface.

### The System Core Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        TAURI DESKTOP CONTAINMENT                       │
│                                                                        │
│  ┌────────────────────────────────────────────────────────┐            │
│  │                     FRONTEND LAYER                     │            │
│  │   [React View layer Componentry] <──> [Zustand State]   │            │
│  └───────────────────────────┬────────────────────────────┘            │
│                              │                                         │
│                    Tauri IPC / Bridge Protocol                         │
│                              │                                         │
│  ┌───────────────────────────▼────────────────────────────┐            │
│  │                      BACKEND CORE                      │            │
│  │  [Rust Commands Core] <──> [SQLx Query Driver Bridge]  │            │
│  └───────────────────────────┬────────────────────────────┘            │
└──────────────────────────────┼─────────────────────────────────────────┘
                               │
            Native Local File Access System Calls
                               │
             ┌─────────────────┴─────────────────┐
             │       LOCAL DIRECTORY SYSTEM      │
             │  ├── AppData/Database.sqlite      │
             │  └── AppData/Attachments/(*.pdf)  │
             └───────────────────────────────────┘
```

### Folder Distribution Layout

To keep the codebase from becoming chaotic as features grow, the directory system must maintain strict logical encapsulation. The structure looks like this:

```text
dr-tazi-os/
├── src-tauri/               # Native Rust Desktop Configuration Layer
│   ├── src/
│   │   ├── main.rs          # IPC command router registration
│   │   └── database.rs      # Local SQLite pool management, encryption keys
│   └── Cargo.toml           # Engine dependencies (Tauri, SQLx, SQLite v3)
├── src/                     # Application Front-End Component Core
│   ├── app/                 # Next.js App Router Structure
│   │   ├── layout.tsx       # System-wide Shell Wrapper 
│   │   ├── page.tsx         # Universal Workspace Selector
│   │   ├── calendar/        # Unified Booking Grid Module
│   │   │   └── page.tsx
│   │   └── patients/        # Master Clinical Indexes
│   │       ├── page.tsx     # Directory List View
│   │       └── [id]/        
│   │           └── page.tsx # The Patient Channel Workspace
│   ├── components/          # Pure UI Subsystems
│   │   ├── ui/              # Atomized layout building blocks (Shadcn primitives)
│   │   ├── Sidebar.tsx      # System Controller Navigation Anchor
│   │   ├── VitalsChart.tsx  # Analytical Health Diagnostics Canvas
│   │   └── Workspace.tsx    # Consultation Recording Interface
│   ├── store/               # Front-End Memory Hub
│   │   └── useClinicStore.ts# State Synchronization Engine
│   └── lib/                 # Base Helper Utilities
│       └── utils.ts         # Formatting utilities
├── GEMINI.md                # AI System Architecture Reference Document
└── ARCHITECTURE.md          # Database Design and Schema Spec
```

## Part 3: Relational Data Schema & Storage Blueprint

Data is stored locally in an embedded SQLite v3 database engine, managed safely via Rust command layers to prevent direct injection vulnerabilities.

### Database Architecture

```text
  ┌─────────────────┐             ┌─────────────────┐
  │    PATIENTS     │             │  APPOINTMENTS   │
  ├─────────────────┤             ├─────────────────┤
  │ PK  id          │ 1       0..*│ PK  id          │
  │     amo_id      ├────────────>│ FK  patient_id  │
  │     name        │             │     date_time   │
  │     phone       │             │     status      │
  └────────┬────────┘             └─────────────────┘
           │
           │ 1
           ├──────────────────────────────┐
           │ 0..* │ 0..*
           ▼                              ▼
  ┌─────────────────┐            ┌─────────────────┐
  │  CONSULTATIONS  │            │   ATTACHMENTS   │
  ├─────────────────┤            ├─────────────────┤
  │ PK  id          │ 1      1   │ PK  id          │
  │ FK  patient_id  ├───────────>│ FK  patient_id  │
  │     soap_notes  │            │     file_path   │
  └─────────────────┘            └─────────────────┘
```

### Table Structure Definitions (SQL DDL format)

```sql
-- Core Patient Identity Storage (Optimized for Moroccan AMO Tracking)
CREATE TABLE patients (
    id TEXT PRIMARY KEY NOT NULL,
    amo_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    birth_date TEXT NOT NULL,
    insurance_scheme TEXT CHECK(insurance_scheme IN ('AMO-Achamil', 'AMO-Tadamon', 'CNSS-Private')) NOT NULL,
    chronic_conditions TEXT NOT NULL, -- JSON string mapping string arrays
    allergies TEXT NOT NULL,            -- JSON string mapping string arrays
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Appointment Lifecycle Ledger
CREATE TABLE appointments (
    id TEXT PRIMARY KEY NOT NULL,
    patient_id TEXT NOT NULL,
    date_time TEXT NOT NULL, -- ISO-8601 string sequence
    status TEXT CHECK(status IN ('scheduled', 'waiting', 'in_exam', 'billing', 'completed')) NOT NULL DEFAULT 'scheduled',
    checked_in_at TEXT,
    notes TEXT,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- Longitudinal Consultation Repository
CREATE TABLE consultations (
    id TEXT PRIMARY KEY NOT NULL,
    patient_id TEXT NOT NULL,
    appointment_id TEXT UNIQUE NOT NULL,
    date TEXT NOT NULL,
    soap_subjective TEXT NOT NULL,
    soap_objective TEXT NOT NULL,
    soap_assessment TEXT NOT NULL,
    soap_plan TEXT NOT NULL,
    prescribed_meds TEXT NOT NULL, -- JSON formatted structural list
    fse_qr_token TEXT NOT NULL,    -- Encoded transaction matrix matching 2026 codes
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id)
);

-- File Cabinet Meta Mapping (Pointers to physical local disk assets)
CREATE TABLE attachments (
    id TEXT PRIMARY KEY NOT NULL,
    patient_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);
```

## Part 4: Navigation Architecture & Router Mappings

The application layout shifts depending on whether the active workspace profile is toggled to Doctor mode or Secretary mode.

### Layout Flow Map

```text
                       ┌─────────────────────────┐
                       │      GLOBAL SHELL       │
                       │ (Sidebar Anchor System) │
                       └────────────┬────────────┘
                                    │
            ┌───────────────────────┴───────────────────────┐
    Doctor UI Workspace                             Secretary UI Workspace
            │                                               │
    ├── (/) Dashboard View                          ├── (/) Check-in / Queue
    ├── (/calendar) Weekly Clinic Grid              ├── (/calendar) Booking Hub
    └── (/patients) Directory                       └── (/billing) FSE Verification
         └── /[id] Patient Channel File
```

### URL Map Hierarchy

/ [Root Access Switcher]: Determines the system role dashboard.

Doctor Mode View: Shows the real-time clinical queue tracker, triage statistics, and high-priority chronic patient notifications.

Secretary Mode View: Displays active check-in tools, current wait-times, and instant payment-pending alert boards.

/calendar [Unified Scheduling Center]: Displays a weekly grid calendar. Both profiles access this layout to schedule, move, or cancel appointments. The UI tracks which user created or modified each event.

/patients [Master Patient Index]: A fast, indexed directory table containing client name search indexes, phone listings, and active AMO insurance metrics.

/patients/[id] [The Patient Channel]: The clinical core view (restricted or locked to read-only mode for secretaries; fully interactive for doctors). Shows the historical timeline, vitals line charts, and active consultation text areas.

## Part 5: The Master Copilot Implementation Checklist

This checklist acts as a step-by-step assembly guide. Do not create files out of order. Instruct Copilot or your choice of AI assistant to implement each step completely before moving to the next.

```text
[ ] Step 1: Initialize Project Structuring ──> [ ] Step 2: Establish Global Zustand Engine
                                                                       │
                                                                       ▼
[ ] Step 4: Assemble Main Dashboard Modules <── [ ] Step 3: Global Shell & Layout Setup
         │
         ▼
[ ] Step 5: Calendar Grid Sub-system ─────────> [ ] Step 6: Patients List & Dynamic Profiles
```

### Step 1: Initialize Project Structuring

- [ ] Verify your folder layout matches Part 2 exactly.
- [ ] Populate src/lib/utils.ts with standard utility primitives for formatting classes and Tailwind layout handling.
- [ ] Inject the SQLite schema configuration directly into an architectural database init asset under src-tauri/src/database.rs.

### Step 2: Establish the Global Zustand Engine

- [ ] Create src/store/useClinicStore.ts.
- [ ] Build types and interfaces matching the database models from Part 3 exactly.
- [ ] Build mock datasets consisting of 3 realistic Moroccan profiles with local phone coordinates, AMO categories, and baseline medical parameters.
- [ ] Write functional status mutations: setPatientStatus(id, status), addAppointment(data), and appendConsultationNote(patientId, noteData).

### Step 3: Global Shell and Layout Setup

- [ ] Code the visual layout under src/components/Sidebar.tsx. Add role navigation buttons (Doctor vs. Secretary).
- [ ] Code src/app/layout.tsx. Integrate the Sidebar component on the left view axis (w-64), wrapping the core view content on the right with a soft slate background layout wrapper.
- [ ] Add a global language selection toggle (FR / AR) inside the main layout engine.

### Step 4: Assemble Main Dashboard Modules

- [ ] Open src/app/page.tsx. Implement condition blocks filtering views by active role.
- [ ] Create the Live Clinic Flow component to display active patients sorted by checkout priority.
- [ ] Integrate wait-time warnings: color the card borders light orange if a patient's wait timer passes 20 minutes.

### Step 5: Calendar Grid Sub-system

- [ ] Open src/app/calendar/page.tsx. Implement a standard weekly grid structure mapping days horizontally and work hours vertically.
- [ ] Connect the calendar blocks directly to the Zustand state store.
- [ ] Build a minimal overlay pop-up form allowing immediate entry of booking names, date/time parameters, and reason for consultation.

### Step 6: Patients List and Dynamic Profiles

- [ ] Code src/app/patients/page.tsx. Create a fast datatable showing names, unique AMO identifiers, and registration timestamps. Add an instant text filtering search bar at the top.
- [ ] Build the dynamic path route template folder: src/app/patients/[id]/page.tsx.
- [ ] Inside the dynamic path, construct the Vitals Chart Layout using a minimal LineChart component from Recharts.
- [ ] Build the Consultation Workspace View with dedicated text areas mapping to each part of the SOAP clinical reporting standard.