'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useClinicStore } from '../../store/useClinicStore';
import { useAuth } from '@/context/AuthContext';
import { getRolePermissions, type UserRole } from '@/lib/roles';
import { Search } from 'lucide-react';

export default function PatientsPage() {
  const { currentUser } = useAuth();
  const permissions = getRolePermissions(currentUser?.role as UserRole | undefined);
  const patients = useClinicStore((s) => s.patients);
  const [query, setQuery] = useState('');

  const normalized = query.trim().toLowerCase();
  const filtered = patients.filter((p) => {
    if (!normalized) return true;
    return (
      p.name.toLowerCase().includes(normalized) ||
      p.amo_id.toLowerCase().includes(normalized) ||
      // support searching by CIN (id card) if present
      ((p as any).cin || '').toLowerCase().includes(normalized)
    );
  });

  const initials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="w-full min-h-screen bg-slate-50 p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Patient Directory</h1>
          <p className="text-sm text-slate-500 mt-1">Master list of registered patients</p>
          {!permissions.canViewPatientDetails && (
            <p className="mt-2 text-xs font-medium text-amber-700">
              Your role has limited access to patient details.
            </p>
          )}
        </div>
        <div>
          {permissions.canAddPatients ? <AddPatientButton /> : null}
        </div>
      </div>

      {/* Search */}
      <div className="mb-6 max-w-3xl">
        <label className="relative block">
          <span className="sr-only">Search patients</span>
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-slate-400" />
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or AMO ID..."
            className="w-full rounded-2xl border border-slate-200 bg-white px-12 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-teal-100 focus:border-teal-400"
          />
        </label>
      </div>

      {/* Table-style list */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-auto">
        <table className="min-w-full divide-y divide-slate-200 table-auto">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">AMO ID</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">CIN</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Insurance</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Conditions</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-slate-600">
                  No patients found.
                </td>
              </tr>
            ) : (
              filtered.map((patient) => (
                <tr key={patient.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 align-top">
                    <Link href={permissions.canViewPatientDetails ? `/patients/${patient.id}` : '#'} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center font-semibold">{initials(patient.name)}</div>
                      <div>
                        <div className="font-semibold text-slate-900">{patient.name}</div>
                        <div className="text-xs text-slate-500 mt-1">{patient.amo_id}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <div className="text-sm text-slate-700">{patient.amo_id}</div>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <div className="text-sm text-slate-700">{(patient as any).cin || '—'}</div>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <div className="text-sm text-slate-700">{patient.phone}</div>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <div className="text-sm text-slate-700">{patient.insurance_scheme}</div>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <div className="flex flex-wrap gap-2">
                      {patient.chronic_conditions && patient.chronic_conditions.length > 0 ? (
                        patient.chronic_conditions.slice(0, 4).map((c, i) => (
                          <span key={i} className="inline-block px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded">{c}</span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top text-right">
                    {permissions.canViewPatientDetails ? (
                      <Link href={`/patients/${patient.id}`} className="text-sm text-teal-600 font-medium hover:underline">View</Link>
                    ) : (
                      <span className="text-sm text-slate-400">Limited</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AddPatientButton() {
  const addPatient = useClinicStore((s) => s.addPatient);
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState('');
  const [amoId, setAmoId] = useState('');
  const [cin, setCin] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [insurance, setInsurance] = useState<'AMO-Achamil' | 'AMO-Tadamon' | 'CNSS-Private'>('AMO-Achamil');
  const [conditions, setConditions] = useState('');
  const [allergies, setAllergies] = useState('');

  const openNativeDatePicker = (
    event: React.MouseEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>
  ) => {
    const input = event.currentTarget;

    if (event.type === 'click' && typeof input.showPicker === 'function') {
      try {
        input.showPicker();
      } catch {
        // Ignore browsers that block programmatic picker opening.
      }
    }
  };

  const reset = () => {
    setName('');
    setAmoId('');
    setCin('');
    setPhone('');
    setBirthDate('');
    setInsurance('AMO-Achamil');
    setConditions('');
    setAllergies('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await addPatient({
        amo_id: amoId || `AMO-UNK-${Math.floor(Math.random() * 10000)}`,
        name,
        cin: cin || undefined,
        phone,
        birth_date: birthDate || new Date().toISOString().slice(0, 10),
        insurance_scheme: insurance,
        chronic_conditions: conditions ? conditions.split(',').map((s) => s.trim()) : [],
        allergies: allergies ? allergies.split(',').map((s) => s.trim()) : [],
      });

      reset();
      setOpen(false);
    } catch (error) {
      console.error('Failed to create patient:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg shadow-sm hover:bg-teal-700"
      >
        + Add Patient
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-8">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <form onSubmit={handleSubmit} className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">New Patient</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-700">Close</button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="col-span-2">
                <div className="text-xs text-slate-600 mb-1">Full name</div>
                <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border px-3 py-2" />
              </label>

              <label>
                <div className="text-xs text-slate-600 mb-1">AMO ID</div>
                <input value={amoId} onChange={(e) => setAmoId(e.target.value)} className="w-full rounded-md border px-3 py-2" />
              </label>

              <label>
                <div className="text-xs text-slate-600 mb-1">CIN</div>
                <input value={cin} onChange={(e) => setCin(e.target.value)} className="w-full rounded-md border px-3 py-2" />
              </label>

              <label>
                <div className="text-xs text-slate-600 mb-1">Phone</div>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-md border px-3 py-2" />
              </label>

              <label>
                <div className="text-xs text-slate-600 mb-1">Birth date</div>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  onClick={openNativeDatePicker}
                  className="w-full min-h-11 cursor-pointer rounded-md border px-3 py-2 appearance-auto"
                />
              </label>

              <label>
                <div className="text-xs text-slate-600 mb-1">Insurance</div>
                <select value={insurance} onChange={(e) => setInsurance(e.target.value as any)} className="w-full rounded-md border px-3 py-2">
                  <option>AMO-Achamil</option>
                  <option>AMO-Tadamon</option>
                  <option>CNSS-Private</option>
                </select>
              </label>

              <label className="col-span-2">
                <div className="text-xs text-slate-600 mb-1">Chronic conditions (comma separated)</div>
                <input value={conditions} onChange={(e) => setConditions(e.target.value)} className="w-full rounded-md border px-3 py-2" />
              </label>

              <label className="col-span-2">
                <div className="text-xs text-slate-600 mb-1">Allergies (comma separated)</div>
                <input value={allergies} onChange={(e) => setAllergies(e.target.value)} className="w-full rounded-md border px-3 py-2" />
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => { reset(); setOpen(false); }} className="px-4 py-2 rounded-md border">Cancel</button>
              <button type="submit" disabled={isSaving} className="px-4 py-2 rounded-md bg-teal-600 text-white disabled:opacity-60">
                {isSaving ? 'Saving...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
