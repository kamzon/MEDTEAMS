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
  date_time: string;
  status: 'scheduled' | 'waiting' | 'in_exam' | 'billing' | 'completed';
  checked_in_at: string | null;
  notes: string;
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

type StoredClinicState = Pick<ClinicStore, 'patients' | 'appointments' | 'consultations' | 'attachments'>;

const AUTH_STORAGE_KEY = 'medteams-active-user';
const STORE_KEY_PREFIX = 'medteams-clinic-store';
const SHARED_STORE_KEY = `${STORE_KEY_PREFIX}:shared`;
const ANONYMOUS_STORE_KEY = `${STORE_KEY_PREFIX}:anonymous`;

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
  return username ? SHARED_STORE_KEY : ANONYMOUS_STORE_KEY;
}

function loadScopedStore(username: string | null): StoredClinicState | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const sharedStored = localStorage.getItem(SHARED_STORE_KEY);
    if (sharedStored) {
      return JSON.parse(sharedStored) as StoredClinicState;
    }

    const legacyStored = username ? localStorage.getItem(`${STORE_KEY_PREFIX}:${username}`) : null;
    if (legacyStored) {
      localStorage.setItem(SHARED_STORE_KEY, legacyStored);
      return JSON.parse(legacyStored) as StoredClinicState;
    }

    const stored = localStorage.getItem(getScopedStoreKey(username));
    return stored ? (JSON.parse(stored) as StoredClinicState) : null;
  } catch (error) {
    console.warn('Failed to load clinic store from localStorage:', error);
    return null;
  }
}

function saveScopedStore(
  username: string | null,
  state: StoredClinicState
) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(SHARED_STORE_KEY, JSON.stringify(state));

    if (username) {
      localStorage.setItem(`${STORE_KEY_PREFIX}:${username}`, JSON.stringify(state));
    } else {
      localStorage.setItem(ANONYMOUS_STORE_KEY, JSON.stringify(state));
    }
  } catch (error) {
    console.warn('Failed to save clinic store to localStorage:', error);
  }
}

function buildLocalPatient(patient: PatientInput): Patient {
  return {
    ...patient,
    id: uuidv4(),
    created_at: new Date().toISOString(),
  };
}

function buildLocalAppointment(appointment: AppointmentInput): Appointment {
  return {
    ...appointment,
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

    set({
      patients: stored?.patients ?? [],
      appointments: stored?.appointments ?? [],
      consultations: stored?.consultations ?? [],
      attachments: stored?.attachments ?? [],
      isInitialized: true,
      activeUsername,
    });
  },

  setActiveUserScope: async (username) => {
    const stored = loadScopedStore(username);

    set({
      patients: stored?.patients ?? [],
      appointments: stored?.appointments ?? [],
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
        appointments: state.appointments,
        consultations: state.consultations,
        attachments: state.attachments,
      });

      return { patients: newPatients };
    });

    return fallbackPatient;
  },

  addPatientAndQueue: async (patient, appointmentNotes) => {
    const createdAt = new Date().toISOString();
    const fallbackPatient: Patient = {
      ...patient,
      id: uuidv4(),
      created_at: createdAt,
    };
    const fallbackAppointment: Appointment = {
      id: uuidv4(),
      patient_id: fallbackPatient.id,
      date_time: createdAt,
      status: 'waiting',
      checked_in_at: createdAt,
      notes: appointmentNotes ?? 'New patient intake pending clinical review.',
    };

    set((state) => {
      const newPatients = [...state.patients, fallbackPatient];
      const newAppointments = [...state.appointments, fallbackAppointment];
      saveScopedStore(state.activeUsername, {
        patients: newPatients,
        appointments: newAppointments,
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
        appointments: state.appointments,
        consultations: state.consultations,
        attachments: state.attachments,
      });

      return { patients: newPatients };
    });
  },

  getPatientById: (id) => get().patients.find((patient) => patient.id === id),

  addAppointment: async (appointment) => {
    const fallbackAppointment = buildLocalAppointment(appointment);

    set((state) => {
      const newAppointments = [...state.appointments, fallbackAppointment];
      saveScopedStore(state.activeUsername, {
        patients: state.patients,
        appointments: newAppointments,
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

      saveScopedStore(state.activeUsername, {
        patients: state.patients,
        appointments: newAppointments,
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

      saveScopedStore(state.activeUsername, {
        patients: state.patients,
        appointments: newAppointments,
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
        appointments: state.appointments,
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
        appointments: state.appointments,
        consultations: state.consultations,
        attachments: newAttachments,
      });

      return { attachments: newAttachments };
    });
  },

  getAttachmentsByPatient: (patientId) =>
    get().attachments.filter((attachment) => attachment.patient_id === patientId),
}));