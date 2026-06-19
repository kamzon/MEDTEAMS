'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useClinicStore } from '../../../store/useClinicStore';
import VitalsChart from '@/components/VitalsChart';
import { getRolePermissions, type UserRole } from '@/lib/roles';
import { useAppSettingsStore } from '@/store/useAppSettingsStore';

export default function PatientClinicalWorkspace() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const { currentUser } = useAuth();
  const language = useAppSettingsStore((state) => state.language);
  const permissions = getRolePermissions(currentUser?.role as UserRole | undefined);
  const addConsultationNote = useClinicStore((s) => s.addConsultationNote);
  const isFrench = language === 'FR';

  const ui = {
    loading: isFrench ? 'Chargement...' : 'Loading...',
    notFoundTitle: isFrench ? 'Patient introuvable' : 'Patient Not Found',
    notFoundBody: isFrench ? 'Nous n’avons pas trouvé le patient demandé.' : "We couldn't find the requested patient.",
    back: isFrench ? '← Retour au répertoire' : '← Back to Directory',
    phone: isFrench ? 'Téléphone' : 'Phone',
    birthDate: isFrench ? 'Date de naissance' : 'Birth Date',
    restricted: isFrench ? 'Les notes cliniques et les actions de consultation sont restreintes pour votre rôle.' : 'Clinical notes and consultation actions are restricted for your role.',
    criticalInfo: isFrench ? 'Informations critiques' : 'Critical Information',
    allergies: isFrench ? 'Allergies' : 'Allergies',
    noAllergies: isFrench ? 'Aucune allergie connue' : 'No known allergies',
    chronicConditions: isFrench ? 'Pathologies chroniques' : 'Chronic Conditions',
    vitalsHistory: isFrench ? 'Historique des constantes (TA & HbA1c)' : 'Vitals History (BP & HbA1c)',
    activeConsultation: isFrench ? 'Consultation active (SOAP)' : 'Active Consultation (SOAP)',
    patient: isFrench ? 'Patient' : 'Patient',
    subjective: isFrench ? 'Subjectif' : 'Subjective',
    objective: isFrench ? 'Objectif' : 'Objective',
    assessment: isFrench ? 'Évaluation' : 'Assessment',
    plan: isFrench ? 'Plan' : 'Plan',
    save: isFrench ? 'Enregistrer la consultation et générer le FSE' : 'Save Consultation & Generate FSE',
    consultationSaved: isFrench ? 'Consultation enregistrée (en mémoire) et le FSE sera généré.' : 'Consultation saved (in-memory) and FSE will be generated.',
    complaintPlaceholder: isFrench ? 'Plainte du patient — ex. « J’ai des douleurs thoraciques depuis 2 jours »' : "Patient's complaint — e.g. 'I've had chest pain for 2 days'",
    objectivePlaceholder: isFrench ? 'Constatations, signes vitaux, analyses' : 'Examination findings, vitals, labs',
    assessmentPlaceholder: isFrench ? 'Diagnostic et diagnostic différentiel' : 'Diagnosis and differential',
    planPlaceholder: isFrench ? 'Plan de traitement, prescriptions, suivi' : 'Treatment plan, prescriptions, follow-up',
    registered: isFrench ? 'Enregistré :' : 'Registered:',
  };

  const [patient, setPatient] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [subjective, setSubjective] = useState('');
  const [objective, setObjective] = useState('');
  const [assessment, setAssessment] = useState('');
  const [plan, setPlan] = useState('');

  useEffect(() => {
    if (id) {
      const found = useClinicStore.getState().getPatientById(id);
      setPatient(found);
      setLoaded(true);
    }
  }, [id]);

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-slate-500">{ui.loading}</div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-xl w-full bg-white rounded-xl shadow-lg border p-8 text-center">
          <h2 className="text-2xl font-semibold text-slate-900">{ui.notFoundTitle}</h2>
          <p className="mt-3 text-slate-600">{ui.notFoundBody}</p>
          <div className="mt-6">
            <Link href="/patients" className="inline-block px-4 py-2 bg-teal-600 text-white rounded-md">{ui.back}</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!permissions.canViewPatientDetails) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="mb-4">
          <Link href="/patients" className="text-slate-500 hover:text-slate-700">{ui.back}</Link>
        </div>
        <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">{patient.name}</h1>
          <p className="mt-2 text-sm text-slate-500">{patient.amo_id} • {patient.insurance_scheme}</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</div>
              <div className="mt-1 text-sm text-slate-900">{patient.phone}</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Birth Date</div>
              <div className="mt-1 text-sm text-slate-900">{patient.birth_date}</div>
            </div>
          </div>
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Clinical notes and consultation actions are restricted for your role.
          </div>
        </div>
      </div>
    );
  }

  const handleSave = () => {
    const consultation = {
      patient_id: patient.id,
      appointment_id: '',
      date: new Date().toISOString(),
      soap_subjective: subjective,
      soap_objective: objective,
      soap_assessment: assessment,
      soap_plan: plan,
      prescribed_meds: [],
      fse_qr_token: '',
    };
    addConsultationNote(consultation);
    // lightweight feedback
    setSubjective('');
    setObjective('');
    setAssessment('');
    setPlan('');
    window.alert(ui.consultationSaved);
  };

  return (
    <div className="w-full min-h-screen bg-slate-50 p-8">
      <div className="flex items-center gap-4">
        <Link href="/patients" className="text-slate-500 hover:text-slate-700">{ui.back}</Link>
      </div>

      <header className="mt-4 bg-white p-6 rounded-xl shadow-sm border flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{patient.name}</h1>
          <div className="mt-1 text-sm text-slate-500">{patient.amo_id} • <span className="font-medium text-slate-700">{patient.insurance_scheme}</span></div>
        </div>
        <div className="mt-4 sm:mt-0 text-sm text-slate-500">{ui.registered} {new Date(patient.created_at).toLocaleString()}</div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
        {/* Left column: Clinical Profile */}
        <aside className="col-span-1 space-y-4">
          <section className="bg-white rounded-xl border shadow-sm p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">{ui.criticalInfo}</h3>

            <div className="mb-4">
              <div className="text-xs text-slate-500 mb-2">{ui.allergies}</div>
              <div className="flex flex-wrap gap-2">
                {patient.allergies && patient.allergies.length > 0 ? (
                  patient.allergies.map((a: string, i: number) => (
                    <span key={i} className="inline-block px-2 py-1 text-xs font-medium text-red-800 bg-red-50 border border-red-100 rounded">{a}</span>
                  ))
                ) : (
                  <div className="text-xs text-slate-400">{ui.noAllergies}</div>
                )}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500 mb-2">{ui.chronicConditions}</div>
              <div className="flex flex-wrap gap-2">
                {patient.chronic_conditions && patient.chronic_conditions.length > 0 ? (
                  patient.chronic_conditions.map((c: string, i: number) => (
                    <span key={i} className="inline-block px-2 py-1 text-xs text-slate-700 bg-slate-100 rounded">{c}</span>
                  ))
                ) : (
                  <div className="text-xs text-slate-400">—</div>
                )}
              </div>
            </div>
          </section>

          <section className="bg-white rounded-xl border shadow-sm p-4 flex flex-col" style={{ height: '300px' }}>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">{ui.vitalsHistory}</h3>
            <div className="flex-1 min-h-0">
              <VitalsChart />
            </div>
          </section>
        </aside>

        {/* Right column: Active Consultation (span 2) */}
        <section className="col-span-1 lg:col-span-2">
          <div className="bg-white rounded-2xl border shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-900">{ui.activeConsultation}</h2>
              <div className="text-sm text-slate-500">{ui.patient}: <span className="font-medium text-slate-700">{patient.name}</span></div>
            </div>

            <form className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">{ui.subjective}</label>
                <textarea
                  value={subjective}
                  onChange={(e) => setSubjective(e.target.value)}
                  placeholder={ui.complaintPlaceholder}
                  className="mt-2 w-full min-h-[88px] rounded-lg border border-slate-200 shadow-sm p-4 text-slate-800 focus:outline-none focus:ring-4 focus:ring-teal-50"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">{ui.objective}</label>
                <textarea
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder={ui.objectivePlaceholder}
                  className="mt-2 w-full min-h-[88px] rounded-lg border border-slate-200 shadow-sm p-4 text-slate-800 focus:outline-none focus:ring-4 focus:ring-teal-50"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">{ui.assessment}</label>
                <textarea
                  value={assessment}
                  onChange={(e) => setAssessment(e.target.value)}
                  placeholder={ui.assessmentPlaceholder}
                  className="mt-2 w-full min-h-[88px] rounded-lg border border-slate-200 shadow-sm p-4 text-slate-800 focus:outline-none focus:ring-4 focus:ring-teal-50"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">{ui.plan}</label>
                <textarea
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  placeholder={ui.planPlaceholder}
                  className="mt-2 w-full min-h-[88px] rounded-lg border border-slate-200 shadow-sm p-4 text-slate-800 focus:outline-none focus:ring-4 focus:ring-teal-50"
                />
              </div>

              <div className="mt-4 flex justify-end">
                <button type="button" onClick={handleSave} className="px-6 py-3 rounded-full bg-teal-600 text-white font-medium shadow hover:bg-teal-700">{ui.save}</button>
              </div>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
