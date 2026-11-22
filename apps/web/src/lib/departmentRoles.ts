export const DEPARTMENT_ROLES = [
  'Crew Lead',
  'Field Technician',
  'Driver / Equipment Operator',
  'Inspector / Verifier',
  'Safety Officer',
  'General Worker',
] as const;

export type DepartmentRole = typeof DEPARTMENT_ROLES[number];

export interface AssignedTeamMember {
  profile_id: string;
  full_name: string;
  assigned_role: DepartmentRole;
  capabilities: DepartmentRole[];
  open_assignments: number;
  is_team_lead: boolean;
}
