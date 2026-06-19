export type StoredAuthUser = {
  id: string;
  username: string;
  password: string;
  role: string;
  name: string;
};

export type UserRole = 'DOCTOR' | 'SECRETARY' | 'OWNER';

export const USERS_STORAGE_KEY = 'medteams-auth-users';

export const DEFAULT_LOCAL_USERS: StoredAuthUser[] = [
  {
    id: 'local-admin',
    username: 'admin',
    password: 'admin123',
    role: 'OWNER',
    name: 'Dr. Tazi',
  },
];

export function loadLocalUsers(): StoredAuthUser[] {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCAL_USERS;
  }

  try {
    const stored = window.localStorage.getItem(USERS_STORAGE_KEY);
    if (!stored) {
      window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_LOCAL_USERS));
      return DEFAULT_LOCAL_USERS;
    }

    const parsed = JSON.parse(stored) as StoredAuthUser[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_LOCAL_USERS));
      return DEFAULT_LOCAL_USERS;
    }

    return parsed;
  } catch {
    window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_LOCAL_USERS));
    return DEFAULT_LOCAL_USERS;
  }
}

export function saveLocalUsers(users: StoredAuthUser[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

export function loginLocalUser(username: string, password: string) {
  const users = loadLocalUsers();
  const match = users.find(
    (user) => user.username.toLowerCase() === username.toLowerCase() && user.password === password
  );

  if (!match) {
    throw new Error('Invalid username or password');
  }

  const { password: _password, ...sessionUser } = match;
  return sessionUser;
}

export function addLocalUser(user: Omit<StoredAuthUser, 'id'>) {
  const users = loadLocalUsers();
  const usernameExists = users.some(
    (existingUser) => existingUser.username.toLowerCase() === user.username.toLowerCase()
  );

  if (usernameExists) {
    throw new Error('Username already exists');
  }

  const createdUser: StoredAuthUser = {
    id: `local-${Date.now()}`,
    ...user,
  };

  saveLocalUsers([...users, createdUser]);

  const { password: _password, ...sessionUser } = createdUser;
  return sessionUser;
}

export function updateLocalUserRole(userId: string, role: UserRole) {
  const users = loadLocalUsers();
  const updatedUsers = users.map((user) => (user.id === userId ? { ...user, role } : user));

  saveLocalUsers(updatedUsers);

  const updatedUser = updatedUsers.find((user) => user.id === userId);
  if (!updatedUser) {
    throw new Error('Staff member not found');
  }

  const { password: _password, ...sessionUser } = updatedUser;
  return sessionUser;
}

export function deleteLocalUser(userId: string) {
  const users = loadLocalUsers();
  const targetUser = users.find((user) => user.id === userId);

  if (!targetUser) {
    throw new Error('Staff member not found');
  }

  if (targetUser.role === 'OWNER') {
    throw new Error('Owner account cannot be deleted');
  }

  const updatedUsers = users.filter((user) => user.id !== userId);
  saveLocalUsers(updatedUsers);

  return targetUser;
}