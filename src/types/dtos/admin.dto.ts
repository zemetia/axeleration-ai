export interface AdminDTO {
  id: string;
  full_name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'moderator';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminListDTO {
  data: AdminDTO[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
