import type {
  Course,
  CourseModule,
  CreateCourseModuleRequest,
  CreateCourseRequest,
  CreateInstrumentRequest,
  CreateLessonMaterialRequest,
  CreateLessonRequest,
  Instrument,
  Lesson,
  LessonMaterial,
  PaginatedResult,
  UpdateCourseModuleRequest,
  UpdateCourseRequest,
  UpdateInstrumentRequest,
  UpdateLessonMaterialRequest,
  UpdateLessonRequest,
} from 'shared';
import { apiRequest } from '../api-client';

export const instrumentsApi = {
  list: (query?: { page?: number; limit?: number; status?: string }) =>
    apiRequest<PaginatedResult<Instrument>>('/instruments', { query }),
  get: (id: string) => apiRequest<Instrument>(`/instruments/${id}`),
  create: (body: CreateInstrumentRequest) =>
    apiRequest<Instrument>('/instruments', { method: 'POST', body }),
  update: (id: string, body: UpdateInstrumentRequest) =>
    apiRequest<Instrument>(`/instruments/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => apiRequest<void>(`/instruments/${id}`, { method: 'DELETE' }),
};

export const coursesApi = {
  list: (query?: {
    instrumentId?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => apiRequest<PaginatedResult<Course>>('/courses', { query }),
  get: (id: string) => apiRequest<Course>(`/courses/${id}`),
  create: (body: CreateCourseRequest) => apiRequest<Course>('/courses', { method: 'POST', body }),
  update: (id: string, body: UpdateCourseRequest) =>
    apiRequest<Course>(`/courses/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => apiRequest<void>(`/courses/${id}`, { method: 'DELETE' }),
};

export const courseModulesApi = {
  list: (courseId: string, query?: { page?: number; limit?: number; status?: string }) =>
    apiRequest<PaginatedResult<CourseModule>>(`/courses/${courseId}/modules`, { query }),
  create: (courseId: string, body: CreateCourseModuleRequest) =>
    apiRequest<CourseModule>(`/courses/${courseId}/modules`, { method: 'POST', body }),
  update: (id: string, body: UpdateCourseModuleRequest) =>
    apiRequest<CourseModule>(`/course-modules/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => apiRequest<void>(`/course-modules/${id}`, { method: 'DELETE' }),
};

export const lessonsApi = {
  list: (moduleId: string, query?: { page?: number; limit?: number; status?: string }) =>
    apiRequest<PaginatedResult<Lesson>>(`/modules/${moduleId}/lessons`, { query }),
  get: (id: string) => apiRequest<Lesson>(`/lessons/${id}`),
  create: (moduleId: string, body: CreateLessonRequest) =>
    apiRequest<Lesson>(`/modules/${moduleId}/lessons`, { method: 'POST', body }),
  update: (id: string, body: UpdateLessonRequest) =>
    apiRequest<Lesson>(`/lessons/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => apiRequest<void>(`/lessons/${id}`, { method: 'DELETE' }),
};

export const lessonMaterialsApi = {
  list: (lessonId: string) =>
    apiRequest<PaginatedResult<LessonMaterial>>(`/lessons/${lessonId}/materials`),
  create: (lessonId: string, body: CreateLessonMaterialRequest) =>
    apiRequest<LessonMaterial>(`/lessons/${lessonId}/materials`, { method: 'POST', body }),
  update: (id: string, body: UpdateLessonMaterialRequest) =>
    apiRequest<LessonMaterial>(`/lesson-materials/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => apiRequest<void>(`/lesson-materials/${id}`, { method: 'DELETE' }),
};
