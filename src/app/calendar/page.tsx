'use client';

import { FormEvent, useState } from 'react';
import { useClinicStore } from '../../store/useClinicStore';
import { Plus, Clock, User, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

export default function CalendarPage() {
  const patients = useClinicStore((state) => state.patients);
  const appointments = useClinicStore((state) => state.appointments);
  const addAppointment = useClinicStore((state) => state.addAppointment);

  // Modal and form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    patientId: '',
    dateTime: new Date().toISOString().slice(0, 16),
    reason: '',
  });

  // Get start and end of current week
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const date = new Date();
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  });

  // Time slots for the calendar (09:00 to 17:00)
  const timeSlots = Array.from({ length: 9 }, (_, i) => {
    const hour = 9 + i;
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
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
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
      alert('Please fill in all fields');
      return;
    }

    const selectedPatient = patients.find((p) => p.id === formData.patientId);
    if (!selectedPatient) {
      alert('Invalid patient selected');
      return;
    }

    addAppointment({
      patient_id: formData.patientId,
      date_time: new Date(formData.dateTime).toISOString(),
      status: 'scheduled',
      checked_in_at: null,
      notes: formData.reason,
    });

    // Reset form and close modal
    setFormData({
      patientId: '',
      dateTime: new Date().toISOString().slice(0, 16),
      reason: '',
    });
    setIsModalOpen(false);
  };

  // Get appointments for a specific day and time slot
  const getAppointmentsForSlot = (dayDate: Date, hourStart: number) => {
    return appointments.filter((apt) => {
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

  const getStatusBadge = (status: string) => {
    const labels: Record<string, string> = {
      scheduled: 'Scheduled',
      waiting: 'Waiting',
      in_exam: 'In Exam',
      billing: 'Billing',
      completed: 'Completed',
    };
    return labels[status] || status;
  };

  return (
    <div className="w-full min-h-screen bg-slate-50 p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Agenda & Booking Hub</h1>
          <p className="text-slate-600">
            {formatDateFull(weekStart)} to {formatDateFull(new Date(new Date(weekStart).getTime() + 6 * 24 * 60 * 60 * 1000))}
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors shadow-md"
        >
          <Plus className="w-5 h-5" />
          New Appointment
        </button>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => moveWeek('prev')}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors text-slate-700 font-medium"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous Week
        </button>
        <span className="text-sm font-semibold text-slate-600">Week View</span>
        <button
          onClick={() => moveWeek('next')}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors text-slate-700 font-medium"
        >
          Next Week
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header Row - Day Names */}
        <div className="grid grid-cols-8 border-b border-slate-200">
          {/* Time column header */}
          <div className="col-span-1 p-4 bg-slate-50 border-r border-slate-200">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Time</p>
          </div>

          {/* Day headers */}
          {weekDays.map((day, idx) => (
            <div key={idx} className="col-span-1 p-4 bg-slate-50 border-r border-slate-200 text-center">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                {day.toLocaleDateString('en-US', { weekday: 'short' })}
              </p>
              <p className="text-lg font-bold text-slate-900 mt-1">{day.getDate()}</p>
            </div>
          ))}
        </div>

        {/* Time slots and appointments */}
        {timeSlots.map((slot, slotIdx) => (
          <div key={slotIdx} className="grid grid-cols-8 border-b border-slate-200 min-h-24">
            {/* Time label */}
            <div className="col-span-1 p-4 bg-slate-50 border-r border-slate-200 flex items-center justify-center sticky left-0">
              <p className="text-sm font-semibold text-slate-700">{slot.label}</p>
            </div>

            {/* Day cells */}
            {weekDays.map((day, dayIdx) => {
              const slotAppointments = getAppointmentsForSlot(day, slot.hour);
              const hasAppointments = slotAppointments.length > 0;

              return (
                <div
                  key={dayIdx}
                  className={`col-span-1 p-2 border-r border-slate-200 relative ${
                    hasAppointments ? 'bg-white' : 'bg-slate-50 hover:bg-slate-100 transition-colors'
                  }`}
                >
                  {hasAppointments ? (
                    <div className="space-y-1">
                      {slotAppointments.map((apt) => {
                        const patient = patients.find((p) => p.id === apt.patient_id);
                        const aptTime = new Date(apt.date_time);
                        const displayTime = `${String(aptTime.getHours()).padStart(2, '0')}:${String(aptTime.getMinutes()).padStart(2, '0')}`;

                        return (
                          <div
                            key={apt.id}
                            className={`p-2 rounded-lg border-l-4 text-xs cursor-pointer hover:shadow-md transition-shadow ${getStatusColor(apt.status)}`}
                          >
                            <div className="font-semibold text-slate-900 truncate">
                              {patient?.name || 'Unknown Patient'}
                            </div>
                            <div className="text-slate-600 mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {displayTime}
                            </div>
                            <div className="mt-1">
                              <span className="inline-block px-1.5 py-0.5 bg-white bg-opacity-60 rounded text-xs font-medium">
                                {getStatusBadge(apt.status)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Schedule New Appointment</h2>
                <p className="text-sm text-slate-500 mt-1">Add a new appointment to the calendar</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                Close
              </button>
            </div>

            {/* Modal Content */}
            <form onSubmit={handleAddAppointment} className="grid gap-4 px-6 py-6">
              {/* Patient Select */}
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Patient
                </span>
                <select
                  required
                  name="patientId"
                  value={formData.patientId}
                  onChange={handleFormChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                >
                  <option value="">Select a patient...</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.name} ({patient.amo_id})
                    </option>
                  ))}
                </select>
              </label>

              {/* Date & Time */}
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  Date & Time
                </span>
                <input
                  required
                  type="datetime-local"
                  name="dateTime"
                  value={formData.dateTime}
                  onChange={handleFormChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                />
              </label>

              {/* Reason/Notes */}
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Reason for Visit</span>
                <textarea
                  required
                  name="reason"
                  value={formData.reason}
                  onChange={handleFormChange}
                  placeholder="e.g., Regular checkup, Follow-up examination..."
                  className="min-h-24 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                />
              </label>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4 mt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
                >
                  Save Appointment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stats Footer */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Total Appointments</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{appointments.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">This Week</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">
            {appointments.filter((apt) => {
              const aptDate = new Date(apt.date_time);
              const aptWeekStart = new Date(aptDate);
              aptWeekStart.setDate(aptWeekStart.getDate() - aptWeekStart.getDay() + 1);
              return aptDate >= weekStart && aptDate < new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
            }).length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Completed</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">
            {appointments.filter((apt) => apt.status === 'completed').length}
          </p>
        </div>
      </div>
    </div>
  );
}
