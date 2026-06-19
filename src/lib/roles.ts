export type UserRole = 'DOCTOR' | 'SECRETARY' | 'OWNER';

export interface RolePermissions {
  canViewPatients: boolean;
  canAddPatients: boolean;
  canViewPatientDetails: boolean;
  canEditClinicalNotes: boolean;
  canManageStaff: boolean;
}

export function getRoleLabel(role: UserRole | string | undefined) {
  switch (role) {
    case 'OWNER':
      return 'Owner';
    case 'SECRETARY':
      return 'Secretary';
    case 'DOCTOR':
      return 'Doctor';
    default:
      return 'User';
  }
}

export function getRolePermissions(role: UserRole | string | undefined): RolePermissions {
  switch (role) {
    case 'OWNER':
      return {
        canViewPatients: true,
        canAddPatients: true,
        canViewPatientDetails: true,
        canEditClinicalNotes: true,
        canManageStaff: true,
      };
    case 'DOCTOR':
      return {
        canViewPatients: true,
        canAddPatients: true,
        canViewPatientDetails: true,
        canEditClinicalNotes: true,
        canManageStaff: false,
      };
    case 'SECRETARY':
      return {
        canViewPatients: true,
        canAddPatients: true,
        canViewPatientDetails: false,
        canEditClinicalNotes: false,
        canManageStaff: false,
      };
    default:
      return {
        canViewPatients: false,
        canAddPatients: false,
        canViewPatientDetails: false,
        canEditClinicalNotes: false,
        canManageStaff: false,
      };
  }
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}