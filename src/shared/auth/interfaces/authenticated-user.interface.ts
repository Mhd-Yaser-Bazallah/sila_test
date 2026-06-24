import { Role } from '../enums/role.enum';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: Role;
  status: string;
  companyId: string | null;
  company?: {
    id: string;
    name: string;
    logoUrl?: string | null;
    status: string;
    serviceSubscriptions?: {
      serviceType: string;
      status: string;
    }[];
  } | null;
}
