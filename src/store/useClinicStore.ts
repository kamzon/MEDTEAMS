'use client';

import { invoke } from '@tauri-apps/api/core';
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

  initStore: () => Promise<void>;

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

function isTauriRuntime() {
  return (
    typeof window !== 'undefined' &&
    Boolean((window as Window & { __TAURI__?: unknown }).__TAURI__)
  );
}

const STORE_KEY = 'medteams-clinic-store';

function saveToLocalStorage(patients: Patient[], appointments: Appointment[], consultations: Consultation[], attachments: Attachment[]) {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          patients,
          appointments,
          consultations,
          attachments,
        })
      );
    } catch (error) {
      console.warn('Failed to save store to localStorage:', error);
    }
  }
}

function loadFromLocalStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = localStorage.getItem(STORE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('Failed to load store from localStorage:', error);
  }

  return null;
}

async function invokeBackend<T>(command: string, args?: Record<string, unknown>) {
  if (!isTauriRuntime()) {
    throw new Error('Tauri IPC is only available inside the desktop shell');
  }

  return invoke<T>(command, args);
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

  initStore: async () => {
    if (get().isInitialized) {
      return;
    }

    if (!isTauriRuntime()) {
      // Load from localStorage if available
      const stored = loadFromLocalStorage();
      if (stored) {
        set({
          patients: stored.patients,
          appointments: stored.appointments,
          consultations: stored.consultations,
          attachments: stored.attachments,
          isInitialized: true,
        });
      } else {
        set({ isInitialized: true });
      }
      return;
    }

    try {
      const [patients, appointments, consultations, attachments] = await Promise.all([
        invokeBackend<Patient[]>('get_patients'),
        invokeBackend<Appointment[]>('get_appointments'),
        invokeBackend<Consultation[]>('get_consultations'),
        invokeBackend<Attachment[]>('get_attachments'),
      ]);

      set({
        patients,
        appointments,
        consultations,
        attachments,
        isInitialized: true,
      });
    } catch (error) {
      console.error('Failed to initialize clinic store from SQLite:', error);
      set({ isInitialized: true });
    }
  },

  addPatient: async (patient) => {
    if (!isTauriRuntime()) {
      const fallbackPatient = buildLocalPatient(patient);

      set((state) => {
        const newPatients = [...state.patients, fallbackPatient];
        saveToLocalStorage(newPatients, state.appointments, state.consultations, state.attachments);
        return {
          patients: newPatients,
        };
      });

      return fallbackPatient;
    }

    try {
      const createdPatient = await invokeBackend<Patient>('add_patient', { patient });

      set((state) => ({
        patients: [...state.patients, createdPatient],
      }));

      return createdPatient;
    } catch (error) {
      console.error('Failed to add patient in backend, falling back to local state:', error);
      const fallbackPatient = buildLocalPatient(patient);

      set((state) => {
        const newPatients = [...state.patients, fallbackPatient];
        saveToLocalStorage(newPatients, state.appointments, state.consultations, state.attachments);
        return {
          patients: newPatients,
        };
      });

      return fallbackPatient;
    }
  },

  addPatientAndQueue: async (patient, appointmentNotes) => {
    if (!isTauriRuntime()) {
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
        saveToLocalStorage(newPatients, newAppointments, state.consultations, state.attachments);
        return {
          patients: newPatients,
          appointments: newAppointments,
        };
      });

      return { patient: fallbackPatient, appointment: fallbackAppointment };
    }

    try {
      const created = await invokeBackend<{ patient: Patient; appointment: Appointment }>(
        'add_patient_and_queue',
        {
          patient,
          appointmentNotes,
        }
      );

      set((state) => ({
        patients: [...state.patients, created.patient],
        appointments: [...state.appointments, created.appointment],
      }));

      return created;
    } catch (error) {
      console.error('Failed to queue patient in backend, falling back to local state:', error);
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
        saveToLocalStorage(newPatients, newAppointments, state.consultations, state.attachments);
        return {
          patients: newPatients,
          appointments: newAppointments,
        };
      });

      return { patient: fallbackPatient, appointment: fallbackAppointment };
    }
  },

  updatePatient: (id, updates) => {
    set((state) => {
      const newPatients = state.patients.map((patient) =>
        patient.id === id ? { ...patient, ...updates } : patient
      );
      if (!isTauriRuntime()) {
        saveToLocalStorage(newPatients, state.appointments, state.consultations, state.attachments);
      }
      return {
        patients: newPatients,
      };
    });
  },

  getPatientById: (id) => get().patients.find((patient) => patient.id === id),

  addAppointment: async (appointment) => {
    if (!isTauriRuntime()) {
      const fallbackAppointment = buildLocalAppointment(appointment);

      set((state) => {
        const newAppointments = [...state.appointments, fallbackAppointment];
        saveToLocalStorage(state.patients, newAppointments, state.consultations, state.attachments);
        return {
          appointments: newAppointments,
        };
      });

      return fallbackAppointment;
    }

    try {
      const createdAppointment = await invokeBackend<Appointment>('add_appointment', {
        appointment,
      });

      set((state) => ({
        appointments: [...state.appointments, createdAppointment],
      }));

      return createdAppointment;
    } catch (error) {
      console.error('Failed to add appointment in backend, falling back to local state:', error);
      const fallbackAppointment = buildLocalAppointment(appointment);

      set((state) => {
        const newAppointments = [...state.appointments, fallbackAppointment];
        saveToLocalStorage(state.patients, newAppointments, state.consultations, state.attachments);
        return {
          appointments: newAppointments,
        };
      });

      return fallbackAppointment;
    }
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
      if (!isTauriRuntime()) {
        saveToLocalStorage(state.patients, newAppointments, state.consultations, state.attachments);
      }
      return {
        appointments: newAppointments,
      };
    });
  },

  updatePatientStatus: async (patientId, status) => {
    if (isTauriRuntime()) {
      try {
        await invokeBackend<number>('update_patient_status', {
          patientId,
          status,
        });
      } catch (error) {
        console.error('Failed to update patient status in backend, falling back to local state:', error);
      }
    }

    let appointmentUpdated = false;

    set((state) => {
      const newAppointments = state.appointments.map((appointment) => {
        if (
          !appointmentUpdated &&
          appointment.patient_id === patientId &&
          (appointment.status === 'waiting' || appointment.status === 'scheduled')
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
      
      if (!isTauriRuntime()) {
        saveToLocalStorage(state.patients, newAppointments, state.consultations, state.attachments);
      }
      
      return {
        appointments: newAppointments,
      };
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
    if (!isTauriRuntime()) {
      const fallbackConsultation: Consultation = {
        ...consultation,
        id: uuidv4(),
      };

      set((state) => {
        const newConsultations = [...state.consultations, fallbackConsultation];
        saveToLocalStorage(state.patients, state.appointments, newConsultations, state.attachments);
        return {
          consultations: newConsultations,
        };
      });

      return fallbackConsultation;
    }

    try {
      const consultationId = await invokeBackend<string>('save_consultation', {
        consultation,
      });

      const createdConsultation: Consultation = {
        ...consultation,
        id: consultationId,
      };

      set((state) => ({
        consultations: [...state.consultations, createdConsultation],
      }));

      return createdConsultation;
    } catch (error) {
      console.error('Failed to save consultation in backend, falling back to local state:', error);
      const fallbackConsultation: Consultation = {
        ...consultation,
        id: uuidv4(),
      };

      set((state) => {
        const newConsultations = [...state.consultations, fallbackConsultation];
        saveToLocalStorage(state.patients, state.appointments, newConsultations, state.attachments);
        return {
          consultations: newConsultations,
        };
      });

      return fallbackConsultation;
    }
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
      if (!isTauriRuntime()) {
        saveToLocalStorage(state.patients, state.appointments, state.consultations, newAttachments);
      }
      return {
        attachments: newAttachments,
      };
    });
  },

  getAttachmentsByPatient: (patientId) =>
    get().attachments.filter((attachment) => attachment.patient_id === patientId),
}));
