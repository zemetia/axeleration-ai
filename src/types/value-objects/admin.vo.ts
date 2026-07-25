export interface AdminVO {
  id: string;
  fullName: string;
  email: string;
  role: 'super_admin' | 'admin' | 'moderator';
  roleLabel: string;
  isActive: boolean;
  statusLabel: string;
  createdAt: string;
  initials: string;
}

export interface AdminListVO {
  items: AdminVO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  isEmpty: boolean;
}
