'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useClinicStore } from '../store/useClinicStore';
import { useAuth } from '@/context/AuthContext';
import { addLocalUser, loginLocalUser, loadLocalUsers, USERS_STORAGE_KEY } from '@/lib/localUsers';
import {
  Users,
  Clock,
  Calendar,
  QrCode,
  UserPlus,
  FileText,
  ChevronRight,
  ClipboardCheck,
} from 'lucide-react';

type SessionUser = {
  id: string;
  username: string;
  role: string;
  name: string;
};

const AUTH_STORAGE_KEY = 'medteams-active-user';

function isTauriRuntime() {
  if (typeof window === 'undefined') {
    return false;
  }

  const tauriWindow = window as Window & {
    __TAURI__?: {
      invoke?: unknown;
      core?: {
        invoke?: unknown;
      };
    };
  };

  return Boolean(tauriWindow.__TAURI__?.invoke || tauriWindow.__TAURI__?.core?.invoke);
}

async function invokeTauriCommand<T>(command: string, args?: Record<string, unknown>) {
  if (typeof window === 'undefined') {
    throw new Error('Tauri commands are only available in the browser runtime');
  }

  const tauriWindow = window as Window & {
    __TAURI__?: {
      invoke?: <Result>(command: string, args?: Record<string, unknown>) => Promise<Result>;
      core?: {
        invoke?: <Result>(command: string, args?: Record<string, unknown>) => Promise<Result>;
      };
    };
  };

  const invoke = tauriWindow.__TAURI__?.invoke ?? tauriWindow.__TAURI__?.core?.invoke;

  if (!invoke) {
    throw new Error('Tauri IPC is unavailable');
  }

  return invoke<T>(command, args);
}

export default function DashboardPage() {
  const { currentUser, setCurrentUser } = useAuth();
  const appointments = useClinicStore((state) => state.appointments);
  const consultations = useClinicStore((state) => state.consultations);
  const patients = useClinicStore((state) => state.patients);
  const addPatient = useClinicStore((state) => state.addPatient);
  const addAppointment = useClinicStore((state) => state.addAppointment);
  const updatePatientStatus = useClinicStore((state) => state.updatePatientStatus);
  const getWaitingRoom = useClinicStore((state) => state.getWaitingRoom);

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);
  const [walkInFormOpen, setWalkInFormOpen] = useState(false);
  const todayKey = new Date().toISOString().slice(0, 10);
  const [walkInForm, setWalkInForm] = useState({
    name: '',
    phone: '',
    birth_date: '',
    insurance_scheme: 'AMO-Achamil' as 'AMO-Achamil' | 'AMO-Tadamon' | 'CNSS-Private',
    chronic_conditions: '',
    allergies: '',
  });
  const [queueFormOpen, setQueueFormOpen] = useState(false);
  const [queueForm, setQueueForm] = useState({
    patient_id: '',
    notes: '',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: '',
  });
  const [doctorForm, setDoctorForm] = useState({
    name: '',
    username: '',
    password: '',
  });

  // Get waiting room - canonical source of truth for waiting patients
  // Already sorted by check-in time (earliest first = longest waiting)
  const waitingAppointments = getWaitingRoom();

  const scheduledAppointments = appointments.filter(
    (apt) => apt.status === 'scheduled'
  );

  const todaysAppointments = scheduledAppointments.filter(
    (appointment) => appointment.date_time.slice(0, 10) === todayKey
  );

  // The longest waiting patient is the first one in the sorted waiting room
  const longestWaitingPatientId = waitingAppointments[0]?.patient_id;

  // Sort today's scheduled appointments by time for agenda
  const todaysAgenda = [...todaysAppointments]
    .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime())
    .slice(0, 4);

  const completedExaminations = Array.from(
    (() => {
      const examinationMap = new Map<
        string,
        {
          id: string;
          patientId: string;
          patientName: string;
          completedAt: string;
          summary: string;
          hasPrescription: boolean;
        }
      >();

      appointments
        .filter(
          (appointment) =>
            appointment.date_time.slice(0, 10) === todayKey &&
            (appointment.status === 'in_exam' || appointment.status === 'completed')
        )
        .forEach((appointment) => {
          const consultation = consultations.find(
            (item) =>
              item.appointment_id === appointment.id && item.date.slice(0, 10) === todayKey
          );
          const patient = patients.find((item) => item.id === appointment.patient_id);
          const completedAt = consultation?.date ?? appointment.date_time;
          const summarySource =
            consultation?.soap_assessment?.trim() ||
            consultation?.soap_plan?.trim() ||
            appointment.notes.trim() ||
            'Exam in progress';

          examinationMap.set(appointment.id, {
            id: appointment.id,
            patientId: appointment.patient_id,
            patientName: patient?.name ?? 'Unknown patient',
            completedAt,
            summary: summarySource,
            hasPrescription:
              Boolean(consultation?.prescribed_meds.length) ||
              Boolean(consultation?.soap_plan.trim()),
          });
        });

      consultations
        .filter((consultation) => consultation.date.slice(0, 10) === todayKey)
        .forEach((consultation) => {
          const appointment = appointments.find(
            (item) => item.id === consultation.appointment_id
          );
          const patient = patients.find(
            (item) => item.id === consultation.patient_id || item.id === appointment?.patient_id
          );
          const recordKey = consultation.appointment_id || consultation.id;

          if (examinationMap.has(recordKey)) {
            return;
          }

          examinationMap.set(recordKey, {
            id: recordKey,
            patientId: consultation.patient_id || appointment?.patient_id || '',
            patientName: patient?.name ?? 'Unknown patient',
            completedAt: consultation.date,
            summary:
              consultation.soap_assessment.trim() ||
              consultation.soap_plan.trim() ||
              appointment?.notes.trim() ||
              'Assessment not recorded',
            hasPrescription:
              Boolean(consultation.prescribed_meds.length) ||
              Boolean(consultation.soap_plan.trim()),
          });
        });

      return examinationMap;
    })().values()
  )
    .sort((left, right) => new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime());

  const filteredPatients = patients.filter((patient) => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return (
      patient.name.toLowerCase().includes(query) ||
      patient.amo_id.toLowerCase().includes(query)
    );
  });

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getWaitTime = (checkedInAt: string | null) => {
    if (!checkedInAt) return 0;
    return Math.floor(
      (new Date().getTime() - new Date(checkedInAt).getTime()) / 60000
    );
  };

  const showFeedback = (message: string) => {
    if (feedbackTimeoutRef.current) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }

    setFeedbackMessage(message);
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setFeedbackMessage(null);
      feedbackTimeoutRef.current = null;
    }, 2200);
  };

  const handleQuickAction = (label: string) => {
    console.log(`${label} clicked`);
    showFeedback(`${label} is ready`);
  };

  const closeQueueModal = () => {
    setQueueFormOpen(false);
    setQueueForm({
      patient_id: '',
      notes: '',
    });
    setSearchQuery('');
    setIsDropdownOpen(false);
  };

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      const authenticatedUser = isTauriRuntime()
        ? await invokeTauriCommand<SessionUser>('login', {
            username: loginForm.username.trim(),
            password: loginForm.password,
          })
        : loginLocalUser(loginForm.username.trim(), loginForm.password);

      setCurrentUser(authenticatedUser);
      setLoginForm({ username: '', password: '' });
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDoctorRegistration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      const authenticatedUser = isTauriRuntime()
        ? (await invokeTauriCommand<SessionUser>('add_user', {
            username: doctorForm.username.trim(),
            password: doctorForm.password,
            role: 'DOCTOR',
            name: doctorForm.name.trim(),
          })) &&
          (await invokeTauriCommand<SessionUser>('login', {
            username: doctorForm.username.trim(),
            password: doctorForm.password,
          }))
        : addLocalUser({
            username: doctorForm.username.trim(),
            password: doctorForm.password,
            role: 'DOCTOR',
            name: doctorForm.name.trim(),
          });

      setCurrentUser(authenticatedUser);
      setDoctorForm({ name: '', username: '', password: '' });
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Failed to create doctor account');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleWalkInSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextPatientNumber = String(patients.length + 1).padStart(3, '0');

    addPatient({
      amo_id: `AMO-WALK-2026-${nextPatientNumber}`,
      name: walkInForm.name.trim(),
      phone: walkInForm.phone.trim(),
      birth_date: walkInForm.birth_date,
      insurance_scheme: walkInForm.insurance_scheme,
      chronic_conditions: walkInForm.chronic_conditions
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      allergies: walkInForm.allergies
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    });

    setWalkInFormOpen(false);
    setWalkInForm({
      name: '',
      phone: '',
      birth_date: '',
      insurance_scheme: 'AMO-Achamil',
      chronic_conditions: '',
      allergies: '',
    });
    showFeedback('Walk-in patient registered');
  };

  const handleQueueExistingSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const selectedPatient = patients.find((patient) => patient.id === queueForm.patient_id);

    if (!selectedPatient) {
      showFeedback('Select an existing patient first');
      return;
    }

    addAppointment({
      patient_id: selectedPatient.id,
      date_time: new Date().toISOString(),
      status: 'waiting',
      checked_in_at: new Date().toISOString(),
      notes: queueForm.notes.trim() || 'Patient checked in from registry',
    });

    setQueueFormOpen(false);
    setQueueForm({
      patient_id: '',
      notes: '',
    });
    showFeedback('Existing patient added to waiting room');
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedUser = window.localStorage.getItem(AUTH_STORAGE_KEY);
        if (storedUser) {
          setCurrentUser(JSON.parse(storedUser) as SessionUser);
        }

        loadLocalUsers();
      } catch {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
        window.localStorage.removeItem(USERS_STORAGE_KEY);
      }
    }

    setAuthReady(true);
  }, []);

  useEffect(() => {
    if (!feedbackMessage) {
      return;
    }
  }, [feedbackMessage]);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        window.clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  if (!authReady) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm font-medium text-slate-600 shadow-2xl">
          Loading secure workspace...
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-4 text-slate-100">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(20,184,166,0.18),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(148,163,184,0.16),transparent_35%)]" />

        <div className="relative w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-white/95 shadow-2xl backdrop-blur">
          <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="bg-slate-950 px-8 py-10 text-slate-100">
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-teal-200">
                MedTeams Secure Access
              </div>
              <h1 className="mt-6 text-4xl font-bold tracking-tight text-white">
                Create a doctor account and sign into the clinical workspace.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">
                Start with a local doctor profile, then authenticate to unlock the dashboard, calendar, and patient workflows.
              </p>

              <div className="mt-8 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Quick test account</p>
                <div className="grid gap-2 text-sm text-slate-200">
                  <div><span className="text-slate-400">Username:</span> admin</div>
                  <div><span className="text-slate-400">Password:</span> admin123</div>
                  <div><span className="text-slate-400">Role:</span> OWNER</div>
                </div>
                  <p className="text-xs leading-5 text-slate-400">
                    In browser dev mode, new doctor accounts are stored locally in your browser.
                  </p>
              </div>
            </div>

            <div className="bg-white px-8 py-10 text-slate-900">
              <div className="flex items-center gap-2 rounded-full bg-slate-100 p-1 text-sm font-semibold text-slate-500">
                <button
                  type="button"
                  onClick={() => setAuthMode('register')}
                  className={`flex-1 rounded-full px-4 py-2 transition-colors ${
                    authMode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-800'
                  }`}
                >
                  Create Doctor
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className={`flex-1 rounded-full px-4 py-2 transition-colors ${
                    authMode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-800'
                  }`}
                >
                  Sign In
                </button>
              </div>

              {authError && (
                <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {authError}
                </div>
              )}

              {authMode === 'register' ? (
                <form onSubmit={handleDoctorRegistration} className="mt-6 space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Doctor Name</label>
                    <input
                      required
                      value={doctorForm.name}
                      onChange={(event) => setDoctorForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Dr. Khadija Tazi"
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Username</label>
                    <input
                      required
                      value={doctorForm.username}
                      onChange={(event) => setDoctorForm((current) => ({ ...current, username: event.target.value }))}
                      placeholder="dr.khadija"
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Password</label>
                    <input
                      required
                      type="password"
                      value={doctorForm.password}
                      onChange={(event) => setDoctorForm((current) => ({ ...current, password: event.target.value }))}
                      placeholder="Create a password"
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full rounded-xl bg-teal-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {authLoading ? 'Creating doctor...' : 'Create Doctor & Sign In'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleLoginSubmit} className="mt-6 space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Username</label>
                    <input
                      required
                      value={loginForm.username}
                      onChange={(event) => setLoginForm((current) => ({ ...current, username: event.target.value }))}
                      placeholder="admin"
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Password</label>
                    <input
                      required
                      type="password"
                      value={loginForm.password}
                      onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                      placeholder="admin123"
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {authLoading ? 'Signing in...' : 'Sign In'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-8 bg-slate-50 min-h-screen">
      {/* Header with Greeting & Quick Actions */}
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-1">
            Good Morning, {currentUser?.name ?? 'Doctor'}
          </h1>
          <p className="text-slate-600">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        {currentUser && (
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-900">{currentUser?.name}</p>
              <p className="text-xs text-slate-500">{currentUser?.role}</p>
            </div>
          </div>
        )}
      </div>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <button
          type="button"
          onClick={() => handleQuickAction('Scan Patient QR')}
          className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md hover:border-teal-300 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center group-hover:bg-teal-100 transition">
              <QrCode className="w-5 h-5 text-teal-600" strokeWidth={2} />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-900">Scan Patient QR</p>
              <p className="text-xs text-slate-500">Quick check-in</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 ml-auto group-hover:text-teal-600 transition" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => setWalkInFormOpen(true)}
          className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md hover:border-slate-300 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-slate-200 transition">
              <UserPlus className="w-5 h-5 text-slate-600" strokeWidth={2} />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-900">Register Walk-in</p>
              <p className="text-xs text-slate-500">Add new patient</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 ml-auto group-hover:text-slate-600 transition" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setQueueFormOpen(true);
            setQueueForm({
              patient_id: '',
              notes: '',
            });
            setSearchQuery('');
            setIsDropdownOpen(false);
          }}
          className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md hover:border-slate-300 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-slate-200 transition">
              <FileText className="w-5 h-5 text-slate-600" strokeWidth={2} />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-900">Queue Existing Patient</p>
              <p className="text-xs text-slate-500">Add registered patient to waiting room</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 ml-auto group-hover:text-slate-600 transition" />
          </div>
        </button>
      </div>

      {feedbackMessage && (
        <div className="mb-8 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800 shadow-sm">
          {feedbackMessage}
        </div>
      )}

      {walkInFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Register Walk-in Patient</h2>
                <p className="text-sm text-slate-500">Capture a new patient before adding them to the cabinet flow.</p>
              </div>
              <button
                type="button"
                onClick={() => setWalkInFormOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleWalkInSubmit} className="grid gap-4 px-6 py-6 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">Full Name</span>
                <input
                  required
                  value={walkInForm.name}
                  onChange={(event) => setWalkInForm((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                  placeholder="e.g. Khadija El Idrissi"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Phone</span>
                <input
                  required
                  value={walkInForm.phone}
                  onChange={(event) => setWalkInForm((current) => ({ ...current, phone: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                  placeholder="+212 6 00 00 00 00"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Birth Date</span>
                <input
                  required
                  type="date"
                  value={walkInForm.birth_date}
                  onChange={(event) => setWalkInForm((current) => ({ ...current, birth_date: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">Insurance Scheme</span>
                <select
                  value={walkInForm.insurance_scheme}
                  onChange={(event) =>
                    setWalkInForm((current) => ({
                      ...current,
                      insurance_scheme: event.target.value as 'AMO-Achamil' | 'AMO-Tadamon' | 'CNSS-Private',
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                >
                  <option value="AMO-Achamil">AMO-Achamil</option>
                  <option value="AMO-Tadamon">AMO-Tadamon</option>
                  <option value="CNSS-Private">CNSS-Private</option>
                </select>
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">Chronic Conditions</span>
                <textarea
                  value={walkInForm.chronic_conditions}
                  onChange={(event) => setWalkInForm((current) => ({ ...current, chronic_conditions: event.target.value }))}
                  className="min-h-24 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                  placeholder="Separate with commas"
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">Allergies</span>
                <textarea
                  value={walkInForm.allergies}
                  onChange={(event) => setWalkInForm((current) => ({ ...current, allergies: event.target.value }))}
                  className="min-h-24 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                  placeholder="Separate with commas"
                />
              </label>

              <div className="md:col-span-2 flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setWalkInFormOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
                >
                  Register Patient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {queueFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Queue Existing Patient</h2>
                <p className="text-sm text-slate-500">Select a patient who already exists in the registry and add them to the waiting room.</p>
              </div>
              <button
                type="button"
                onClick={closeQueueModal}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleQueueExistingSubmit} className="grid gap-4 px-6 py-6 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">Existing Patient</span>
                <div className="relative">
                  <input
                    required
                    type="text"
                    value={searchQuery}
                    onChange={(event) => {
                      const nextQuery = event.target.value;
                      setSearchQuery(nextQuery);
                      setIsDropdownOpen(true);
                      setQueueForm((current) => ({
                        ...current,
                        patient_id: '',
                      }));
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    placeholder="Search by name or AMO ID..."
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                  />

                  {isDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100">
                      {filteredPatients.length > 0 ? (
                        filteredPatients.map((patient) => (
                          <button
                            key={patient.id}
                            type="button"
                            onClick={() => {
                              setQueueForm((current) => ({
                                ...current,
                                patient_id: patient.id,
                              }));
                              setSearchQuery(patient.name);
                              setIsDropdownOpen(false);
                            }}
                            className="flex w-full flex-col items-start gap-1 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50"
                          >
                            <span className="text-sm font-semibold text-slate-900">{patient.name}</span>
                            <span className="text-xs text-slate-500">AMO ID: {patient.amo_id}</span>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-slate-500">
                          No matching patients found.
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {patients.length === 0 && (
                  <p className="text-xs text-amber-600">No registered patients available. Register one first.</p>
                )}
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">Queue Notes</span>
                <textarea
                  value={queueForm.notes}
                  onChange={(event) => setQueueForm((current) => ({ ...current, notes: event.target.value }))}
                  className="min-h-24 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                  placeholder="Optional triage notes or visit reason"
                />
              </label>

              <div className="md:col-span-2 flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={closeQueueModal}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
                >
                  Queue Patient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side - Active Flow (2 columns) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats Cards - Smaller & Sleeker */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Patients
                  </p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {patients.length}
                  </p>
                </div>
                <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" strokeWidth={2} />
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Waiting
                  </p>
                  <p className="text-2xl font-bold text-orange-600 mt-1">
                    {waitingAppointments.length}
                  </p>
                </div>
                <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-orange-600" strokeWidth={2} />
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Appointments
                  </p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">
                    {appointments.length}
                  </p>
                </div>
                <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-emerald-600" strokeWidth={2} />
                </div>
              </div>
            </div>
          </div>

          {/* Live Waiting Room - Enhanced */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-5 h-5 bg-orange-100 rounded-lg flex items-center justify-center">
                <Clock className="w-3 h-3 text-orange-600" strokeWidth={2.5} />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Live Waiting Room</h2>
              <span className="ml-auto text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                {waitingAppointments.length} {waitingAppointments.length === 1 ? 'patient' : 'patients'}
              </span>
            </div>

            {waitingAppointments.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-6 h-6 text-slate-400" strokeWidth={1.5} />
                </div>
                <p className="text-slate-600 font-medium">No patients waiting</p>
                <p className="text-sm text-slate-400 mt-1">Waiting room is empty</p>
              </div>
            ) : (
              <div className="space-y-3">
                {waitingAppointments.map((apt, index) => {
                  const patient = patients.find((p) => p.id === apt.patient_id);
                  const waitTime = getWaitTime(apt.checked_in_at);
                  const isLongestWaiting = apt.patient_id === longestWaitingPatientId;
                  const isOver15Min = waitTime > 15;

                  return (
                    <div
                      key={apt.id}
                      className={`border rounded-lg p-4 transition-all ${
                        isLongestWaiting
                          ? 'border-teal-300 bg-teal-50'
                          : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        {/* Queue & Patient Info */}
                        <div className="flex items-center gap-3 flex-1">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              isLongestWaiting
                                ? 'bg-teal-600 text-white'
                                : 'bg-orange-100 text-orange-600'
                            }`}
                          >
                            {index + 1}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">
                              {patient?.name}
                            </p>
                            <p className="text-xs text-slate-500">{patient?.amo_id}</p>
                          </div>
                        </div>

                        {/* Wait Time */}
                        <div className="text-right mr-4">
                          <p className="text-xs font-medium text-slate-500">Wait</p>
                          <p
                            className={`text-sm font-bold ${
                              isOver15Min ? 'text-orange-600' : 'text-slate-900'
                            }`}
                          >
                            {waitTime}m
                          </p>
                        </div>

                        {/* Admit Button (for longest waiting) */}
                        {isLongestWaiting && (
                          <button
                            type="button"
                            onClick={() => {
                              if (!patient || !apt) {
                                return;
                              }

                              // Show immediate feedback to user
                              showFeedback(`Admitting ${patient.name} to exam room...`);

                              // Update appointment status with a small delay for visual feedback
                              setTimeout(() => {
                                updatePatientStatus(patient.id, 'in_exam');
                                console.log(`✓ ${patient.name} (${patient.amo_id}) admitted to exam at ${new Date().toLocaleTimeString()}`);
                              }, 300);
                            }}
                            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap"
                          >
                            Admit to Exam
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Completed Today */}
            <div className="mt-6 bg-white border border-slate-200 rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-5 h-5 bg-teal-100 rounded-lg flex items-center justify-center">
                  <ClipboardCheck className="w-3.5 h-3.5 text-teal-600" strokeWidth={2.5} />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Completed Today</h2>
                <span className="ml-auto text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-100">
                  {completedExaminations.length} {completedExaminations.length === 1 ? 'case' : 'cases'}
                </span>
              </div>

              {completedExaminations.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                  <p className="text-sm font-medium text-slate-700">No completed examinations yet</p>
                  <p className="mt-1 text-xs text-slate-500">Finished consults will appear here once they are marked complete.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {completedExaminations.map((entry) => {
                    const completedTime = formatTime(entry.completedAt);

                    return (
                      <Link
                        key={entry.id}
                        href={`/patients/${entry.patientId}`}
                        className="block rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm transition-colors hover:border-teal-200 hover:bg-teal-50/50 focus:outline-none focus:ring-4 focus:ring-teal-100"
                      >
                        <article className="cursor-pointer">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="truncate text-sm font-semibold text-slate-900">
                                  {entry.patientName}
                                </h3>
                                <span className="text-xs font-medium text-slate-500">{completedTime}</span>
                              </div>
                              <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                                {entry.summary}
                              </p>
                            </div>

                            <span
                              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${
                                entry.hasPrescription
                                  ? 'border border-teal-200 bg-teal-50 text-teal-700'
                                  : 'border border-slate-200 bg-slate-100 text-slate-600'
                              }`}
                            >
                              {entry.hasPrescription ? 'Prescription Issued' : 'No Medication'}
                            </span>
                          </div>
                        </article>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side - Today's Agenda (1 column) */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 h-fit">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Today's Agenda</h2>

          {todaysAgenda.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Calendar className="w-5 h-5 text-slate-400" strokeWidth={1.5} />
              </div>
              <p className="text-slate-600 font-medium text-sm">No appointments scheduled for today</p>
              <p className="text-xs text-slate-400 mt-1">Today's agenda is empty</p>
            </div>
          ) : (
            <div className="space-y-4">
              {todaysAgenda.map((apt) => {
                const patient = patients.find((p) => p.id === apt.patient_id);
                const appointmentTime = formatTime(apt.date_time);

                return (
                  <div
                    key={apt.id}
                    className="border-l-3 border-teal-600 pl-4 py-2 relative"
                  >
                    {/* Timeline dot */}
                    <div className="absolute w-3 h-3 bg-teal-600 rounded-full left-[-8.5px] top-[10px]" />

                    <div className="mb-2">
                      <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide">
                        {appointmentTime}
                      </p>
                      <p className="text-sm font-semibold text-slate-900 mt-1">
                        {patient?.name}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <span className="inline-block px-2 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded">
                        {apt.notes || 'Regular'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* See More Link */}
          {todaysAppointments.length > 4 && (
            <button className="mt-6 w-full text-center text-sm font-medium text-teal-600 hover:text-teal-700 py-2 border-t border-slate-200 pt-4">
              View Full Schedule
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
