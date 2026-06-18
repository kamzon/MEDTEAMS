'use client';

import { useEffect, useState, FormEvent } from 'react';
import { Users, Plus, X } from 'lucide-react';

type UserRole = 'DOCTOR' | 'SECRETARY' | 'OWNER';

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
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    username: '',
    password: '',
    role: 'DOCTOR',
  });

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (isTauriRuntime()) {
        const result = await invokeTauriCommand<User[]>('get_users');
        setUsers(result || []);
      } else {
        setUsers([{ id: '1', username: 'admin', role: 'OWNER', name: 'Dr. Tazi' }]);
      }
    } catch {
      setUsers([]);
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

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await invokeTauriCommand('add_user', {
        username: formData.username.trim(),
        password: formData.password,
        role: formData.role,
        name: formData.name.trim(),
      });
      setSuccessMessage(`${formData.name} has been added successfully!`);
      setTimeout(() => setSuccessMessage(null), 3000);
      setFormData({ name: '', username: '', password: '', role: 'DOCTOR' });
      setIsModalOpen(false);
      await fetchUsers();
    } catch (err) {
      if (!isTauriRuntime()) {
        setSuccessMessage(`${formData.name} would be added in Tauri mode`);
        setTimeout(() => setSuccessMessage(null), 3000);
        setFormData({ name: '', username: '', password: '', role: 'DOCTOR' });
        setIsModalOpen(false);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to add staff member');
      }
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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-600 to-teal-700 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Clinic Settings & Team Management</h1>
              <p className="text-sm text-slate-500 mt-1">Manage your clinic staff and permissions</p>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" strokeWidth={2} />
            Add Staff Member
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
              <p className="mt-3 text-slate-600">Loading staff members...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-slate-600 font-medium">No staff members yet</p>
              <p className="text-slate-500 text-sm mt-1">Start by adding your first team member</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Name</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Username</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Role</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Member Since</th>
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
                        <span className="text-slate-500 text-sm">Recently added</span>
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
              <h2 className="text-lg font-bold text-white">Add Staff Member</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-white/70 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g., Dr. Sarah Johnson"
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 transition"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Username</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="e.g., sarah.johnson"
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 transition"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Password</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter a secure password"
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 transition"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Role</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 transition bg-white"
                >
                  <option value="DOCTOR">Doctor</option>
                  <option value="SECRETARY">Secretary</option>
                  <option value="OWNER">Owner</option>
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
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-600/50 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
                >
                  {isSubmitting ? 'Adding...' : 'Add Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
