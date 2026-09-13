export interface ApiKeyDTO {
  id: string;
  userId: string;
  provider: string;
  label: string | null;
  lastFour: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
