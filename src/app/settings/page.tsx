'use client';

import { useEffect, useState, FormEvent } from 'react';
import { Users, Plus, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { addLocalUser, deleteLocalUser, loadLocalUsers, updateLocalUserRole } from '@/lib/localUsers';
import { getInitials, getRoleLabel, getRolePermissions, type UserRole } from '@/lib/roles';
import { useAppSettingsStore } from '@/store/useAppSettingsStore';

interface User {
  id: string;
  username: string;
  role: UserRole;
  name: string;
}

interface FormData {
  name: string;
  username: string;
  password: string;
  role: UserRole;
}

function isTauriRuntime() {
  if (typeof window === 'undefined') return false;
  const tauriWindow = window as any;
  return Boolean(tauriWindow.__TAURI__?.invoke || tauriWindow.__TAURI__?.core?.invoke);
}

async function invokeTauriCommand<T>(command: string, args?: Record<string, unknown>) {
  const tauriWindow = window as any;
  const invoke = tauriWindow.__TAURI__?.invoke ?? tauriWindow.__TAURI__?.core?.invoke;
  if (!invoke) throw new Error('Tauri IPC unavailable');
  return invoke(command, args) as Promise<T>;
}

export default function SettingsPage() {
  const { currentUser } = useAuth();
  const language = useAppSettingsStore((state) => state.language);
  const permissions = getRolePermissions(currentUser?.role);
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, UserRole>>({});

  const [formData, setFormData] = useState<FormData>({
    name: '',
    username: '',
    password: '',
    role: 'DOCTOR',
  });
  const isFrench = language === 'FR';

  const ui = {
    ownerRequired: isFrench ? 'L’accès propriétaire est requis' : 'Owner access required',
    ownerDescription: isFrench ? 'Seul le propriétaire peut gérer les rôles et les permissions du personnel.' : 'Only the owner can manage staff roles and permissions.',
    clinicSettings: isFrench ? 'Paramètres de la clinique et gestion de l’équipe' : 'Clinic Settings & Team Management',
    manageStaff: isFrench ? 'Gérez le personnel et les permissions de votre clinique' : 'Manage your clinic staff and permissions',
    addStaff: isFrench ? 'Ajouter un membre du personnel' : 'Add Staff Member',
    staffAdded: (name: string) => (isFrench ? `${name} a été ajouté avec succès !` : `${name} has been added successfully!`),
    roleUpdated: (name: string, role: string) => (isFrench ? `Le rôle de ${name} a été mis à jour vers ${role}` : `${name} role updated to ${role}`),
    userDeleted: (name: string) => (isFrench ? `${name} a été supprimé avec succès` : `${name} was deleted successfully`),
    ownerCannotDelete: isFrench ? 'Le compte propriétaire ne peut pas être supprimé' : 'Owner account cannot be deleted',
    currentUserDelete: isFrench ? 'Vous ne pouvez pas supprimer le compte que vous utilisez actuellement' : 'You cannot delete the account you are currently using',
    deleteConfirm: (name: string) => (isFrench ? `Supprimer ${name} ? Cette action est irréversible.` : `Delete ${name}? This cannot be undone.`),
    loading: isFrench ? 'Chargement des membres du personnel...' : 'Loading staff members...',
    emptyTitle: isFrench ? 'Aucun membre du personnel pour le moment' : 'No staff members yet',
    emptyBody: isFrench ? 'Commencez par ajouter votre premier membre d’équipe' : 'Start by adding your first team member',
    name: isFrench ? 'Nom' : 'Name',
    username: isFrench ? 'Nom d’utilisateur' : 'Username',
    role: isFrench ? 'Rôle' : 'Role',
    memberSince: isFrench ? 'Membre depuis' : 'Member Since',
    actions: isFrench ? 'Actions' : 'Actions',
    recentlyAdded: isFrench ? 'Ajouté récemment' : 'Recently added',
    fullName: isFrench ? 'Nom complet' : 'Full Name',
    password: isFrench ? 'Mot de passe' : 'Password',
    roleSelect: isFrench ? 'Rôle' : 'Role',
    cancel: isFrench ? 'Annuler' : 'Cancel',
    save: isFrench ? 'Enregistrer' : 'Save',
    delete: isFrench ? 'Supprimer' : 'Delete',
    saving: isFrench ? 'Enregistrement...' : 'Saving...',
    deleting: isFrench ? 'Suppression...' : 'Deleting...',
    adding: isFrench ? 'Ajout...' : 'Adding...',
    close: isFrench ? 'Fermer' : 'Close',
    addModalTitle: isFrench ? 'Ajouter un membre du personnel' : 'Add Staff Member',
    placeholderName: isFrench ? 'ex. Dr Sarah Johnson' : 'e.g., Dr. Sarah Johnson',
    placeholderUsername: isFrench ? 'ex. sarah.johnson' : 'e.g., sarah.johnson',
    placeholderPassword: isFrench ? 'Saisissez un mot de passe sécurisé' : 'Enter a secure password',
    doctor: isFrench ? 'Médecin' : 'Doctor',
    secretary: isFrench ? 'Secrétaire' : 'Secretary',
    owner: isFrench ? 'Propriétaire' : 'Owner',
    noRelatedDocs: isFrench ? 'Aucune documentation associée trouvée.' : 'No related documentation found.',
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let nextUsers: User[] = [];

      if (isTauriRuntime()) {
        const result = await invokeTauriCommand<User[]>('get_users');
        nextUsers = result || [];
      } else {
        nextUsers = loadLocalUsers().map(({ id, username, role, name }) => ({
            id,
            username,
            role: role as UserRole,
            name,
          }));
      }

      setUsers(nextUsers);
      setRoleDrafts(
        nextUsers.reduce<Record<string, UserRole>>((drafts, user) => {
          drafts[user.id] = user.role;
          return drafts;
        }, {})
      );
    } catch {
      setUsers([]);
      setRoleDrafts({});
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRoleChange = (userId: string, role: UserRole) => {
    setRoleDrafts((prev) => ({ ...prev, [userId]: role }));
  };

  const handleUpdateRole = async (user: User) => {
    const nextRole = roleDrafts[user.id] ?? user.role;
    if (nextRole === user.role) {
      return;
    }

    setSavingUserId(user.id);
    setError(null);

    try {
      if (isTauriRuntime()) {
        await invokeTauriCommand('update_user_role_command', {
          user_id: user.id,
          role: nextRole,
        });
      } else {
        updateLocalUserRole(user.id, nextRole);
      }

      setSuccessMessage(`${user.name} role updated to ${nextRole}`);
      setSuccessMessage(ui.roleUpdated(user.name, nextRole));
      await fetchUsers();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update staff role');
    } finally {
      setSavingUserId(null);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (user.role === 'OWNER') {
      setError('Owner account cannot be deleted');
      return;
    }

    if (currentUser?.id === user.id) {
      setError('You cannot delete the account you are currently using');
      return;
    }

    const shouldDelete = window.confirm(`Delete ${user.name}? This cannot be undone.`);
    if (!shouldDelete) {
      return;
    }

    setDeletingUserId(user.id);
    setError(null);

    try {
      if (isTauriRuntime()) {
        await invokeTauriCommand('delete_user_command', { user_id: user.id });
      } else {
        deleteLocalUser(user.id);
      }

      setSuccessMessage(`${user.name} was deleted successfully`);
      setSuccessMessage(ui.userDeleted(user.name));
      await fetchUsers();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete staff member');
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      if (isTauriRuntime()) {
        await invokeTauriCommand('add_user', {
          username: formData.username.trim(),
          password: formData.password,
          role: formData.role,
          name: formData.name.trim(),
        });
        setSuccessMessage(ui.staffAdded(formData.name));
        await fetchUsers();
      } else {
        addLocalUser({
          username: formData.username.trim(),
          password: formData.password,
          role: formData.role,
          name: formData.name.trim(),
        });
        setSuccessMessage(ui.staffAdded(formData.name));
        await fetchUsers();
      }

      setTimeout(() => setSuccessMessage(null), 3000);
      setFormData({ name: '', username: '', password: '', role: 'DOCTOR' });
      setIsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : (isFrench ? 'Impossible d’ajouter le membre du personnel' : 'Failed to add staff member'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleBadgeStyles = (role: UserRole) => {
    switch (role) {
      case 'DOCTOR':
        return 'bg-teal-100 text-teal-700 border border-teal-200';
      case 'SECRETARY':
        return 'bg-purple-100 text-purple-700 border border-purple-200';
      case 'OWNER':
        return 'bg-slate-800 text-white border border-slate-700';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  };

  if (!permissions.canManageStaff) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-12 bg-slate-50">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
            <Users className="h-7 w-7" strokeWidth={1.8} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{ui.ownerRequired}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {ui.ownerDescription}
          </p>
          {currentUser && (
            <div className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-teal-600 to-slate-800 text-sm font-bold text-white">
                {getInitials(currentUser.name)}
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-slate-900">{currentUser.name}</p>
                <p className="text-xs text-slate-500">{getRoleLabel(currentUser.role)}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-600 to-teal-700 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{ui.clinicSettings}</h1>
              <p className="text-sm text-slate-500 mt-1">{ui.manageStaff}</p>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" strokeWidth={2} />
            {ui.addStaff}
          </button>
        </div>
      </div>

      <div className="p-8">
        {successMessage && (
          <div className="mb-6 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
            ✓ {successMessage}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            ✕ {error}
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="inline-block">
                <div className="w-8 h-8 border-2 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
              </div>
              <p className="mt-3 text-slate-600">{ui.loading}</p>
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-slate-600 font-medium">{ui.emptyTitle}</p>
              <p className="text-slate-500 text-sm mt-1">{ui.emptyBody}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">{ui.name}</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">{ui.username}</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">{ui.role}</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">{ui.memberSince}</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">{ui.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-slate-300 to-slate-400 rounded-full flex items-center justify-center">
                            <span className="text-sm font-semibold text-white">
                              {user.name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .toUpperCase()
                                .slice(0, 2)}
                            </span>
                          </div>
                          <span className="font-medium text-slate-900">{user.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-slate-600 font-mono text-sm">{user.username}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getRoleBadgeStyles(
                            user.role
                          )}`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-slate-500 text-sm">{ui.recentlyAdded}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={roleDrafts[user.id] ?? user.role}
                            onChange={(event) => handleRoleChange(user.id, event.target.value as UserRole)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
                          >
                            <option value="DOCTOR">{ui.doctor}</option>
                            <option value="SECRETARY">{ui.secretary}</option>
                            <option value="OWNER">{ui.owner}</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => handleUpdateRole(user)}
                            disabled={(roleDrafts[user.id] ?? user.role) === user.role || savingUserId === user.id}
                            className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-600/50"
                          >
                            {savingUserId === user.id ? ui.saving : ui.save}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(user)}
                            disabled={deletingUserId === user.id || currentUser?.id === user.id || user.role === 'OWNER'}
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingUserId === user.id ? ui.deleting : ui.delete}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between bg-gradient-to-r from-teal-600 to-teal-700">
              <h2 className="text-lg font-bold text-white">{ui.addModalTitle}</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-white/70 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">{ui.fullName}</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder={ui.placeholderName}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 transition"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">{ui.username}</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder={ui.placeholderUsername}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 transition"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">{ui.password}</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder={ui.placeholderPassword}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 transition"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">{ui.roleSelect}</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 transition bg-white"
                >
                  <option value="DOCTOR">{ui.doctor}</option>
                  <option value="SECRETARY">{ui.secretary}</option>
                  <option value="OWNER">{ui.owner}</option>
                </select>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-900 rounded-lg font-semibold hover:bg-slate-50 transition-colors"
                >
                  {ui.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-600/50 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
                >
                  {isSubmitting ? ui.adding : ui.addStaff}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
