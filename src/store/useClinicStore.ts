'use client';

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export interface Patient {
  id: string;
  amo_id: string;
  name: string;
  cin?: string;
  phone: string;
  birth_date: string;
  insurance_scheme: 'AMO-Achamil' | 'AMO-Tadamon' | 'CNSS-Private';
  chronic_conditions: string[];
  allergies: string[];
  created_at: string;
}

export interface Appointment {
  id: string;
  patient_id: string;
  patient_name: string;
  date_time: string;
  status: 'scheduled' | 'waiting' | 'in_exam' | 'billing' | 'completed';
  checked_in_at: string | null;
  notes: string;
  owner_username: string;
}

export interface Consultation {
  id: string;
  patient_id: string;
  appointment_id: string;
  date: string;
  soap_subjective: string;
  soap_objective: string;
  soap_assessment: string;
  soap_plan: string;
  prescribed_meds: Array<{
    name: string;
    dosage: string;
    duration: string;
    frequency: string;
  }>;
  fse_qr_token: string;
}

export interface Attachment {
  id: string;
  patient_id: string;
  file_path: string;
  file_name: string;
  file_type: string;
  uploaded_at: string;
}

export interface PatientInput {
  amo_id: string;
  name: string;
  cin?: string;
  phone: string;
  birth_date: string;
  insurance_scheme: Patient['insurance_scheme'];
  chronic_conditions: string[];
  allergies: string[];
}

export interface AppointmentInput {
  patient_id: string;
  patient_name: string;
  owner_username: string;
  date_time: string;
  status: Appointment['status'];
  checked_in_at: string | null;
  notes: string;
}

export interface ConsultationInput {
  patient_id: string;
  appointment_id: string;
  date: string;
  soap_subjective: string;
  soap_objective: string;
  soap_assessment: string;
  soap_plan: string;
  prescribed_meds: Consultation['prescribed_meds'];
  fse_qr_token: string;
}

export interface ClinicStore {
  patients: Patient[];
  appointments: Appointment[];
  consultations: Consultation[];
  attachments: Attachment[];
  isInitialized: boolean;
  activeUsername: string | null;

  initStore: () => Promise<void>;
  setActiveUserScope: (username: string | null) => Promise<void>;

  addPatient: (patient: PatientInput) => Promise<Patient>;
  addPatientAndQueue: (
    patient: PatientInput,
    appointmentNotes?: string
  ) => Promise<{ patient: Patient; appointment: Appointment }>;
  updatePatient: (id: string, updates: Partial<Patient>) => void;
  getPatientById: (id: string) => Patient | undefined;

  addAppointment: (appointment: AppointmentInput) => Promise<Appointment>;
  updateAppointmentStatus: (
    appointmentId: string,
    status: Appointment['status']
  ) => void;
  updatePatientStatus: (
    patientId: string,
    status: Appointment['status']
  ) => Promise<void>;
  getAppointmentsByPatient: (patientId: string) => Appointment[];
  getAppointmentsByStatus: (status: Appointment['status']) => Appointment[];
  getWaitingRoom: () => Appointment[];

  addConsultationNote: (consultation: ConsultationInput) => Promise<Consultation>;
  getConsultationsByPatient: (patientId: string) => Consultation[];

  addAttachment: (attachment: Omit<Attachment, 'id' | 'uploaded_at'>) => void;
  getAttachmentsByPatient: (patientId: string) => Attachment[];
}

type ScopedClinicState = Pick<ClinicStore, 'patients' | 'consultations' | 'attachments'>;

const AUTH_STORAGE_KEY = 'medteams-active-user';
const STORE_KEY_PREFIX = 'medteams-clinic-store';
const SHARED_APPOINTMENTS_KEY = `${STORE_KEY_PREFIX}:appointments:shared`;

function getActiveUsernameFromStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as { username?: string } | null;
    return parsed?.username ?? null;
  } catch {
    return null;
  }
}

function getScopedStoreKey(username: string | null) {
  return `${STORE_KEY_PREFIX}:${username ?? 'anonymous'}`;
}

function loadScopedStore(username: string | null): ScopedClinicState | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = localStorage.getItem(getScopedStoreKey(username));
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as ScopedClinicState;
    return {
      patients: Array.isArray(parsed.patients) ? parsed.patients : [],
      consultations: Array.isArray(parsed.consultations) ? parsed.consultations : [],
      attachments: Array.isArray(parsed.attachments) ? parsed.attachments : [],
    };
  } catch (error) {
    console.warn('Failed to load clinic store from localStorage:', error);
    return null;
  }
}

function saveScopedStore(
  username: string | null,
  state: ScopedClinicState
) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(getScopedStoreKey(username), JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to save clinic store to localStorage:', error);
  }
}

function normalizeAppointment(
  appointment: Partial<Appointment> & { id: string; patient_id: string; date_time: string; status: Appointment['status']; checked_in_at: string | null; notes: string },
  ownerUsername: string,
  patientName: string
): Appointment {
  return {
    ...appointment,
    patient_name: appointment.patient_name ?? patientName,
    owner_username: appointment.owner_username ?? ownerUsername,
  };
}

function loadSharedAppointments(): Appointment[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const stored = localStorage.getItem(SHARED_APPOINTMENTS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Appointment[];
      return Array.isArray(parsed)
        ? parsed.map((appointment) => ({
            ...appointment,
            patient_name: appointment.patient_name ?? 'Unknown patient',
            owner_username: appointment.owner_username ?? 'shared',
          }))
        : [];
    }

    const mergedAppointments: Appointment[] = [];

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(`${STORE_KEY_PREFIX}:`) || key === SHARED_APPOINTMENTS_KEY) {
        continue;
      }

      const scopeName = key.slice(`${STORE_KEY_PREFIX}:`.length);
      const rawState = localStorage.getItem(key);
      if (!rawState) {
        continue;
      }

      try {
        const parsed = JSON.parse(rawState) as { patients?: Patient[]; appointments?: Appointment[] };
        const patientNames = new Map((parsed.patients ?? []).map((patient) => [patient.id, patient.name]));

        (parsed.appointments ?? []).forEach((appointment) => {
          mergedAppointments.push(
            normalizeAppointment(
              appointment,
              scopeName,
              patientNames.get(appointment.patient_id) ?? 'Unknown patient'
            )
          );
        });
      } catch (error) {
        console.warn('Failed to migrate legacy calendar data:', error);
      }
    }

    localStorage.setItem(SHARED_APPOINTMENTS_KEY, JSON.stringify(mergedAppointments));
    return mergedAppointments;
  } catch (error) {
    console.warn('Failed to load shared appointments from localStorage:', error);
    return [];
  }
}

function saveSharedAppointments(appointments: Appointment[]) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(SHARED_APPOINTMENTS_KEY, JSON.stringify(appointments));
  } catch (error) {
    console.warn('Failed to save shared appointments to localStorage:', error);
  }
}

function buildLocalPatient(patient: PatientInput): Patient {
  return {
    ...patient,
    id: uuidv4(),
    created_at: new Date().toISOString(),
  };
}

function buildLocalAppointment(appointment: AppointmentInput, defaultOwnerUsername: string): Appointment {
  return {
    ...appointment,
    owner_username: appointment.owner_username || defaultOwnerUsername,
    id: uuidv4(),
  };
}

export const useClinicStore = create<ClinicStore>((set, get) => ({
  patients: [],
  appointments: [],
  consultations: [],
  attachments: [],
  isInitialized: false,
  activeUsername: null,

  initStore: async () => {
    if (get().isInitialized) {
      return;
    }

    const activeUsername = getActiveUsernameFromStorage();
    const stored = loadScopedStore(activeUsername);
    const sharedAppointments = loadSharedAppointments();

    set({
      patients: stored?.patients ?? [],
      appointments: sharedAppointments,
      consultations: stored?.consultations ?? [],
      attachments: stored?.attachments ?? [],
      isInitialized: true,
      activeUsername,
    });
  },

  setActiveUserScope: async (username) => {
    const stored = loadScopedStore(username);
    const sharedAppointments = loadSharedAppointments();

    set({
      patients: stored?.patients ?? [],
      appointments: sharedAppointments,
      consultations: stored?.consultations ?? [],
      attachments: stored?.attachments ?? [],
      isInitialized: true,
      activeUsername: username,
    });
  },

  addPatient: async (patient) => {
    const fallbackPatient = buildLocalPatient(patient);

    set((state) => {
      const newPatients = [...state.patients, fallbackPatient];
      saveScopedStore(state.activeUsername, {
        patients: newPatients,
        consultations: state.consultations,
        attachments: state.attachments,
      });

      return { patients: newPatients };
    });

    return fallbackPatient;
  },

  addPatientAndQueue: async (patient, appointmentNotes) => {
    const createdAt = new Date().toISOString();
    const activeUsername = get().activeUsername ?? '';
    const fallbackPatient: Patient = {
      ...patient,
      id: uuidv4(),
      created_at: createdAt,
    };
    const fallbackAppointment: Appointment = {
      id: uuidv4(),
      patient_id: fallbackPatient.id,
      patient_name: fallbackPatient.name,
      owner_username: activeUsername,
      date_time: createdAt,
      status: 'waiting',
      checked_in_at: createdAt,
      notes: appointmentNotes ?? 'New patient intake pending clinical review.',
    };

    set((state) => {
      const newPatients = [...state.patients, fallbackPatient];
      const newAppointments = [...state.appointments, fallbackAppointment];
      saveSharedAppointments(newAppointments);
      saveScopedStore(state.activeUsername, {
        patients: newPatients,
        consultations: state.consultations,
        attachments: state.attachments,
      });

      return {
        patients: newPatients,
        appointments: newAppointments,
      };
    });

    return { patient: fallbackPatient, appointment: fallbackAppointment };
  },

  updatePatient: (id, updates) => {
    set((state) => {
      const newPatients = state.patients.map((patient) =>
        patient.id === id ? { ...patient, ...updates } : patient
      );

      saveScopedStore(state.activeUsername, {
        patients: newPatients,
        consultations: state.consultations,
        attachments: state.attachments,
      });

      return { patients: newPatients };
    });
  },

  getPatientById: (id) => get().patients.find((patient) => patient.id === id),

  addAppointment: async (appointment) => {
    const fallbackAppointment = buildLocalAppointment(appointment, get().activeUsername ?? '');

    set((state) => {
      const newAppointments = [...state.appointments, fallbackAppointment];
      saveSharedAppointments(newAppointments);
      saveScopedStore(state.activeUsername, {
        patients: state.patients,
        consultations: state.consultations,
        attachments: state.attachments,
      });

      return { appointments: newAppointments };
    });

    return fallbackAppointment;
  },

  updateAppointmentStatus: (appointmentId, status) => {
    set((state) => {
      const newAppointments = state.appointments.map((appointment) =>
        appointment.id === appointmentId
          ? {
              ...appointment,
              status,
              checked_in_at:
                status === 'waiting' && !appointment.checked_in_at
                  ? new Date().toISOString()
                  : appointment.checked_in_at,
            }
          : appointment
      );

      saveSharedAppointments(newAppointments);
      saveScopedStore(state.activeUsername, {
        patients: state.patients,
        consultations: state.consultations,
        attachments: state.attachments,
      });

      return { appointments: newAppointments };
    });
  },

  updatePatientStatus: async (patientId, status) => {
    set((state) => {
      let appointmentUpdated = false;

      const newAppointments = state.appointments.map((appointment) => {
        if (
          !appointmentUpdated &&
          appointment.patient_id === patientId &&
          (appointment.status === 'scheduled' || appointment.status === 'waiting' || appointment.status === 'in_exam' || appointment.status === 'billing')
        ) {
          appointmentUpdated = true;
          return {
            ...appointment,
            status,
            checked_in_at:
              status === 'waiting' && !appointment.checked_in_at
                ? new Date().toISOString()
                : appointment.checked_in_at,
          };
        }

        return appointment;
      });

      saveSharedAppointments(newAppointments);
      saveScopedStore(state.activeUsername, {
        patients: state.patients,
        consultations: state.consultations,
        attachments: state.attachments,
      });

      return { appointments: newAppointments };
    });
  },

  getAppointmentsByPatient: (patientId) =>
    get().appointments.filter((appointment) => appointment.patient_id === patientId),

  getAppointmentsByStatus: (status) =>
    get().appointments.filter((appointment) => appointment.status === status),

  getWaitingRoom: () =>
    get()
      .appointments.filter((appointment) => appointment.status === 'waiting')
      .sort((a, b) => {
        const timeA = a.checked_in_at ? new Date(a.checked_in_at).getTime() : 0;
        const timeB = b.checked_in_at ? new Date(b.checked_in_at).getTime() : 0;
        return timeA - timeB;
      }),

  addConsultationNote: async (consultation) => {
    const fallbackConsultation: Consultation = {
      ...consultation,
      id: uuidv4(),
    };

    set((state) => {
      const newConsultations = [...state.consultations, fallbackConsultation];
      saveScopedStore(state.activeUsername, {
        patients: state.patients,
        consultations: newConsultations,
        attachments: state.attachments,
      });

      return { consultations: newConsultations };
    });

    return fallbackConsultation;
  },

  getConsultationsByPatient: (patientId) =>
    get().consultations.filter((consultation) => consultation.patient_id === patientId),

  addAttachment: (attachment) => {
    const newAttachment: Attachment = {
      ...attachment,
      id: uuidv4(),
      uploaded_at: new Date().toISOString(),
    };

    set((state) => {
      const newAttachments = [...state.attachments, newAttachment];
      saveScopedStore(state.activeUsername, {
        patients: state.patients,
        consultations: state.consultations,
        attachments: newAttachments,
      });

      return { attachments: newAttachments };
    });
  },

  getAttachmentsByPatient: (patientId) =>
    get().attachments.filter((attachment) => attachment.patient_id === patientId),
}));