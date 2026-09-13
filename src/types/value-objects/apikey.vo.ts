export interface ApiKeyVO {
  id: string;
  provider: string;
  label: string | null;
  lastFour: string | null;
  isActive: boolean;
  updatedAt: string;
}
