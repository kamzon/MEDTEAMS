'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useClinicStore } from '../../store/useClinicStore';
import { Plus, Clock, User, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getInitials, getRoleLabel } from '@/lib/roles';
import { loadLocalUsers, type StoredAuthUser } from '@/lib/localUsers';
import { useAppSettingsStore } from '@/store/useAppSettingsStore';

export default function CalendarPage() {
  const { currentUser } = useAuth();
  const language = useAppSettingsStore((state) => state.language);
  const patients = useClinicStore((state) => state.patients);
  const appointments = useClinicStore((state) => state.appointments);
  const addAppointment = useClinicStore((state) => state.addAppointment);
  const [calendarUsers, setCalendarUsers] = useState<StoredAuthUser[]>([]);
  const [visibleOwners, setVisibleOwners] = useState<string[]>([]);

  // Modal and form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    patientId: '',
    dateTime: new Date().toISOString().slice(0, 16),
    reason: '',
  });
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);
  const calendarScrollRef = useRef<HTMLDivElement | null>(null);
  const isFrench = language === 'FR';

  // Get start and end of current week
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const date = new Date();
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  });

  const formatDateTimeLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const openAppointmentModal = (day: Date, hour: number) => {
    const nextDateTime = new Date(day);
    nextDateTime.setHours(hour, 0, 0, 0);

    setFormData({
      patientId: '',
      dateTime: formatDateTimeLocal(nextDateTime),
      reason: '',
    });
    setPatientSearchQuery('');
    setIsPatientDropdownOpen(false);
    setIsModalOpen(true);
  };

  const openBlankAppointmentModal = () => {
    setFormData({
      patientId: '',
      dateTime: new Date().toISOString().slice(0, 16),
      reason: '',
    });
    setPatientSearchQuery('');
    setIsPatientDropdownOpen(false);
    setIsModalOpen(true);
  };

  const createAppointmentLabel = (day: Date, slotLabel: string) =>
    isFrench
      ? `Créer un rendez-vous pour le ${day.toLocaleDateString('fr-FR', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        })} à ${slotLabel}`
      : `Create appointment for ${day.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        })} at ${slotLabel}`;

  // Time slots for the calendar (00:00 to 23:00)
  const timeSlots = Array.from({ length: 24 }, (_, i) => {
    const hour = i;
    return {
      hour,
      label: `${String(hour).padStart(2, '0')}:00`,
      startMinutes: hour * 60,
    };
  });

  // Days of the week
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    return date;
  });

  const formatDateFull = (date: Date) => {
    return date.toLocaleDateString(isFrench ? 'fr-FR' : 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const moveWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(weekStart);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setWeekStart(newDate);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddAppointment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formData.patientId || !formData.dateTime || !formData.reason) {
      alert(isFrench ? 'Veuillez remplir tous les champs' : 'Please fill in all fields');
      return;
    }

    const selectedPatient = patients.find((p) => p.id === formData.patientId);
    if (!selectedPatient) {
      alert(isFrench ? 'Patient sélectionné invalide' : 'Invalid patient selected');
      return;
    }

    addAppointment({
      patient_id: formData.patientId,
      patient_name: selectedPatient.name,
      owner_username: currentUser?.username ?? 'shared',
      date_time: new Date(formData.dateTime).toISOString(),
      status: 'scheduled',
      checked_in_at: null,
      notes: formData.reason,
    });

    // Reset form and close modal
    closeModal();
  };

  useEffect(() => {
    const users = loadLocalUsers();
    setCalendarUsers(users);
    setVisibleOwners((currentSelection) => {
      if (currentSelection.length > 0) {
        return currentSelection.filter((username) => users.some((user) => user.username === username));
      }

      return users.map((user) => user.username);
    });
  }, []);

  const ownerOptions: StoredAuthUser[] =
    calendarUsers.length > 0
      ? calendarUsers
      : currentUser
        ? [
            {
              id: currentUser.id,
              username: currentUser.username,
              password: '',
              role: currentUser.role,
              name: currentUser.name,
            },
          ]
        : [];

  const toggleOwnerVisibility = (username: string) => {
    setVisibleOwners((currentSelection) => {
      if (currentSelection.includes(username)) {
        const nextSelection = currentSelection.filter((owner) => owner !== username);
        return nextSelection.length > 0 ? nextSelection : currentSelection;
      }

      return [...currentSelection, username];
    });
  };

  const showAllCalendars = () => {
    setVisibleOwners(ownerOptions.map((user) => user.username));
  };

  const ui = {
    title: isFrench ? 'Agenda et réservations' : 'Agenda & Booking Hub',
    dateRange: isFrench ? 'au' : 'to',
    newAppointment: isFrench ? 'Nouveau rendez-vous' : 'New Appointment',
    previousWeek: isFrench ? 'Semaine précédente' : 'Previous Week',
    weekView: isFrench ? 'Vue semaine' : 'Week View',
    nextWeek: isFrench ? 'Semaine suivante' : 'Next Week',
    people: isFrench ? 'Personnes' : 'People',
    peopleDescription: isFrench
      ? 'Sélectionnez les agendas de l’équipe à afficher, comme dans Outlook.'
      : 'Select which clinic calendars are visible, like Outlook.',
    showAllCalendars: isFrench ? 'Afficher tous les agendas' : 'Show all calendars',
    time: isFrench ? 'Heure' : 'Time',
    timeHeader: isFrench ? 'Heure' : 'Time',
    visible: isFrench ? 'Visible' : 'Visible',
    hidden: isFrench ? 'Masqué' : 'Hidden',
    you: isFrench ? 'Vous' : 'You',
    statusLabels: {
      scheduled: isFrench ? 'Planifié' : 'Scheduled',
      waiting: isFrench ? 'En attente' : 'Waiting',
      in_exam: isFrench ? 'En consultation' : 'In Exam',
      billing: isFrench ? 'Facturation' : 'Billing',
      completed: isFrench ? 'Terminé' : 'Completed',
    },
    createAppointment: (day: Date, slotLabel: string) =>
      isFrench
        ? `Créer un rendez-vous pour le ${day.toLocaleDateString('fr-FR', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
          })} à ${slotLabel}`
        : `Create appointment for ${day.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
          })} at ${slotLabel}`,
    scheduleAppointment: isFrench ? 'Planifier un rendez-vous' : 'Schedule New Appointment',
    modalDescription: isFrench
      ? 'Ajoutez un nouveau rendez-vous au calendrier'
      : 'Add a new appointment to the calendar',
    close: isFrench ? 'Fermer' : 'Close',
    patient: isFrench ? 'Patient' : 'Patient',
    searchPlaceholder: isFrench ? 'Rechercher par nom ou identifiant AMO...' : 'Search by name or AMO ID...',
    noPatients: isFrench ? 'Aucun patient correspondant.' : 'No matching patients found.',
    noRegisteredPatients: isFrench ? 'Aucun patient enregistré disponible. Enregistrez-en un d’abord.' : 'No registered patients available. Register one first.',
    dateTime: isFrench ? 'Date et heure' : 'Date & Time',
    dateTimeHint: isFrench ? 'Choisissez d’abord la date, puis l’heure.' : 'Choose a date first, then a time.',
    reason: isFrench ? 'Motif de la visite' : 'Reason for Visit',
    reasonPlaceholder: isFrench
      ? 'ex. Contrôle régulier, examen de suivi...'
      : 'e.g., Regular checkup, Follow-up examination...',
    cancel: isFrench ? 'Annuler' : 'Cancel',
    save: isFrench ? 'Enregistrer le rendez-vous' : 'Save Appointment',
    totalAppointments: isFrench ? 'Total des rendez-vous' : 'Total Appointments',
    thisWeek: isFrench ? 'Cette semaine' : 'This Week',
    completed: isFrench ? 'Terminés' : 'Completed',
  };

  // Get appointments for a specific day and time slot
  const getAppointmentsForSlot = (dayDate: Date, hourStart: number) => {
    return appointments.filter((apt) => {
      if (visibleOwners.length > 0 && !visibleOwners.includes(apt.owner_username)) {
        return false;
      }

      const aptDate = new Date(apt.date_time);
      const aptHour = aptDate.getHours();
      const aptDay = aptDate.getDate();
      const dayDay = dayDate.getDate();

      return aptHour === hourStart && aptDay === dayDay;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 border-green-300 text-green-700';
      case 'in_exam':
        return 'bg-blue-100 border-blue-300 text-blue-700';
      case 'billing':
        return 'bg-orange-100 border-orange-300 text-orange-700';
      case 'waiting':
        return 'bg-yellow-100 border-yellow-300 text-yellow-700';
      default:
        return 'bg-slate-100 border-slate-300 text-slate-700';
    }
  };

  const getStatusBadge = (status: string) => ui.statusLabels[status as keyof typeof ui.statusLabels] || status;

  const filteredPatients = patients.filter((patient) => {
    const query = patientSearchQuery.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return (
      patient.name.toLowerCase().includes(query) ||
      patient.amo_id.toLowerCase().includes(query)
    );
  });

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({
      patientId: '',
      dateTime: new Date().toISOString().slice(0, 16),
      reason: '',
    });
    setPatientSearchQuery('');
    setIsPatientDropdownOpen(false);
  };

  const visibleAppointments = appointments.filter((appointment) =>
    visibleOwners.length === 0 ? true : visibleOwners.includes(appointment.owner_username)
  );

  useEffect(() => {
    const scrollContainer = calendarScrollRef.current;
    if (!scrollContainer) {
      return;
    }

    const targetHour = scrollContainer.querySelector<HTMLElement>('[data-hour="8"]');
    if (targetHour) {
      scrollContainer.scrollTop = Math.max(targetHour.offsetTop - 72, 0);
    }
  }, []);

  return (
    <div className="w-full min-h-screen bg-slate-50 p-8 dark:bg-slate-950">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">{ui.title}</h1>
          <p className="text-slate-600">
            {formatDateFull(weekStart)} {ui.dateRange} {formatDateFull(new Date(new Date(weekStart).getTime() + 6 * 24 * 60 * 60 * 1000))}
          </p>
          {currentUser && (
            <p className="mt-2 text-sm font-medium text-teal-700">
              {isFrench ? 'Affichage des agendas partagés de la clinique pour' : 'Viewing shared clinic calendars as'} {currentUser.name}
            </p>
          )}
        </div>
        <button
          onClick={openBlankAppointmentModal}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors shadow-md"
        >
          <Plus className="w-5 h-5" />
          {ui.newAppointment}
        </button>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => moveWeek('prev')}
          className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <ChevronLeft className="w-4 h-4" />
          {ui.previousWeek}
        </button>
        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{ui.weekView}</span>
        <button
          onClick={() => moveWeek('next')}
          className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {ui.nextWeek}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      {/* People Bar */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{ui.people}</p>
            <p className="mt-1 text-sm text-slate-600">{ui.peopleDescription}</p>
          </div>
          <button type="button" onClick={showAllCalendars} className="self-start rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-100">
            {ui.showAllCalendars}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          {ownerOptions.map((user, index) => {
            const isVisible = visibleOwners.includes(user.username);
            const colorBands = [
              'from-teal-500 to-emerald-500',
              'from-sky-500 to-blue-500',
              'from-orange-500 to-rose-500',
              'from-violet-500 to-fuchsia-500',
            ];
            const band = colorBands[index % colorBands.length];

            return (
              <button
                key={user.id}
                type="button"
                onClick={() => toggleOwnerVisibility(user.username)}
                className={`flex min-w-56 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
                  isVisible
                    ? 'border-teal-300 bg-teal-50 shadow-sm'
                    : 'border-slate-200 bg-slate-50/80 opacity-70 hover:opacity-100'
                }`}
              >
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${band} text-sm font-bold text-white shadow-sm`}>
                  {getInitials(user.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">{user.name}</span>
                  <span className="block text-xs text-slate-500">
                    {user.username} · {getRoleLabel(user.role)}
                  </span>
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    isVisible ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {isVisible ? ui.visible : ui.hidden}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div ref={calendarScrollRef} className="overflow-auto max-h-[75vh] scroll-smooth">
          {/* Header Row - Day Names */}
          <div className="sticky top-0 z-20 grid grid-cols-8 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            {/* Time column header */}
            <div className="col-span-1 border-r border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">{ui.timeHeader}</p>
            </div>

            {/* Day headers */}
            {weekDays.map((day, idx) => (
              <div key={idx} className="col-span-1 border-r border-slate-200 bg-white p-4 text-center dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                  {day.toLocaleDateString(isFrench ? 'fr-FR' : 'en-US', { weekday: 'short' })}
                </p>
                <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-50">{day.getDate()}</p>
              </div>
            ))}
          </div>

          {/* Time slots and appointments */}
          {timeSlots.map((slot, slotIdx) => {
            const isBusinessHour = slot.hour >= 8 && slot.hour <= 18;

            return (
              <div key={slotIdx} data-hour={slot.hour} className="grid min-h-24 grid-cols-8 border-b border-slate-200 dark:border-slate-800">
                {/* Time label */}
                <div
                  className={`sticky left-0 z-10 col-span-1 flex items-center justify-center border-r border-slate-200 p-4 dark:border-slate-800 ${
                    isBusinessHour ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-950'
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{slot.label}</p>
                </div>

                {/* Day cells */}
                {weekDays.map((day, dayIdx) => {
                  const slotAppointments = getAppointmentsForSlot(day, slot.hour);
                  const hasAppointments = slotAppointments.length > 0;
                  const cellDate = new Date(day);
                  cellDate.setHours(slot.hour, 0, 0, 0);
                  const cellDateTime = formatDateTimeLocal(cellDate);

                  return (
                    <button
                      key={dayIdx}
                      type="button"
                      onClick={() => {
                        if (!hasAppointments) {
                          openAppointmentModal(day, slot.hour);
                        }
                      }}
                      className={`col-span-1 relative border-r border-slate-200 p-2 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-200 dark:border-slate-800 ${
                        hasAppointments
                          ? 'bg-white cursor-default dark:bg-slate-900'
                          : isBusinessHour
                            ? 'bg-white hover:bg-teal-50/60 cursor-pointer dark:bg-slate-900 dark:hover:bg-slate-800'
                            : 'bg-slate-50 hover:bg-slate-100 cursor-pointer dark:bg-slate-950 dark:hover:bg-slate-900'
                      }`}
                      aria-label={createAppointmentLabel(day, slot.label)}
                    >
                      {hasAppointments ? (
                        <div className="space-y-1">
                          {slotAppointments.map((apt) => {
                            const aptTime = new Date(apt.date_time);
                            const displayTime = `${String(aptTime.getHours()).padStart(2, '0')}:${String(aptTime.getMinutes()).padStart(2, '0')}`;
                            const ownerLabel = apt.owner_username === currentUser?.username ? ui.you : apt.owner_username;

                            return (
                              <div
                                key={apt.id}
                                className={`p-2 rounded-lg border-l-4 text-xs cursor-pointer hover:shadow-md transition-shadow ${getStatusColor(apt.status)}`}
                              >
                                <div className="truncate font-semibold text-slate-900 dark:text-slate-50">
                                  {apt.patient_name || (isFrench ? 'Patient inconnu' : 'Unknown patient')}
                                </div>
                                <div className="mt-1 flex items-center gap-1 text-slate-600 dark:text-slate-300">
                                  <Clock className="w-3 h-3" />
                                  {displayTime}
                                </div>
                                <div className="mt-1">
                                  <span className="inline-block rounded bg-white bg-opacity-60 px-1.5 py-0.5 text-xs font-medium dark:bg-slate-800 dark:text-slate-100">
                                    {getStatusBadge(apt.status)}
                                  </span>
                                </div>
                                <div className="mt-1">
                                  <span className="inline-block rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                                    {ownerLabel}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex h-full min-h-24 items-start justify-start">
                          <span className="text-[10px] font-medium text-slate-400 opacity-0 transition-opacity hover:opacity-100">
                            {cellDateTime}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{ui.scheduleAppointment}</h2>
                <p className="text-sm text-slate-500 mt-1">{ui.modalDescription}</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-50"
              >
                {ui.close}
              </button>
            </div>

            {/* Modal Content */}
            <form onSubmit={handleAddAppointment} className="grid gap-4 px-6 py-6">
              {/* Patient Select */}
              <label className="space-y-2">
                <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <User className="w-4 h-4" />
                  {ui.patient}
                </span>
                <div className="relative">
                  <input
                    required
                    type="text"
                    value={patientSearchQuery}
                    onChange={(event) => {
                      const nextQuery = event.target.value;
                      setPatientSearchQuery(nextQuery);
                      setIsPatientDropdownOpen(true);
                      setFormData((prev) => ({ ...prev, patientId: '' }));
                    }}
                    onFocus={() => setIsPatientDropdownOpen(true)}
                    placeholder={ui.searchPlaceholder}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-4 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50 dark:placeholder:text-slate-500 dark:focus:ring-teal-900/30"
                  />

                  {isPatientDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:ring-slate-800">
                      {filteredPatients.length > 0 ? (
                        filteredPatients.map((patient) => (
                          <button
                            key={patient.id}
                            type="button"
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                patientId: patient.id,
                              }));
                              setPatientSearchQuery(`${patient.name} (${patient.amo_id})`);
                              setIsPatientDropdownOpen(false);
                            }}
                            className="flex w-full flex-col items-start gap-1 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                          >
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">{patient.name}</span>
                            <span className="text-xs text-slate-500">AMO ID: {patient.amo_id}</span>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-slate-500">
                          {ui.noPatients}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </label>

              {/* Date & Time */}
              <label className="space-y-2">
                <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <CalendarIcon className="w-4 h-4" />
                  {ui.dateTime}
                </span>
                <p className="text-xs text-slate-500">{ui.dateTimeHint}</p>
                <input
                  required
                  type="datetime-local"
                  name="dateTime"
                  value={formData.dateTime}
                  onChange={handleFormChange}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50 dark:focus:ring-teal-900/30"
                />
              </label>

              {/* Reason/Notes */}
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{ui.reason}</span>
                <textarea
                  required
                  name="reason"
                  value={formData.reason}
                  onChange={handleFormChange}
                  placeholder={ui.reasonPlaceholder}
                  className="min-h-24 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50 dark:focus:ring-teal-900/30"
                />
              </label>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4 mt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {ui.cancel}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400"
                >
                  {ui.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stats Footer */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{ui.totalAppointments}</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{visibleAppointments.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{ui.thisWeek}</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">
            {visibleAppointments.filter((apt) => {
              const aptDate = new Date(apt.date_time);
              const aptWeekStart = new Date(aptDate);
              aptWeekStart.setDate(aptWeekStart.getDate() - aptWeekStart.getDay() + 1);
              return aptDate >= weekStart && aptDate < new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
            }).length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{ui.completed}</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">
            {visibleAppointments.filter((apt) => apt.status === 'completed').length}
          </p>
        </div>
      </div>
    </div>
  );
}
