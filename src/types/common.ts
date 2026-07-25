export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Maybe<T> = T | null | undefined;

export type ValueOf<T extends object> = T[keyof T];

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & unknown;

export type RequiredFields<T, K extends keyof T> = Prettify<
  Omit<T, K> & Required<Pick<T, K>>
>;

export type PartialFields<T, K extends keyof T> = Prettify<
  Omit<T, K> & Partial<Pick<T, K>>
>;

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  status: number;
  message: string;
  errors?: Record<string, string[]>;
}
