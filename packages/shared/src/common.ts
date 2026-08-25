/**
 * Envelope de resposta da API (apps/api/src/common/interceptors/response.interceptor.ts e
 * common/filters/http-exception.filter.ts). Todo DateTime do Prisma chega ao cliente como string
 * ISO 8601 (serializacao JSON padrao do Express/Nest) - por isso os tipos abaixo usam `string`,
 * nunca `Date`, para qualquer campo de data/hora.
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorBody {
  code: string;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorBody;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}
