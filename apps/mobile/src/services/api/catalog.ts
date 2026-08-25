import type {
  Course,
  CourseModule,
  Instrument,
  Lesson,
  LessonMaterial,
  PaginatedResult,
} from 'shared';
import { apiRequest } from '../api-client';

export const catalogApi = {
  listInstruments: (query?: { page?: number; limit?: number }) =>
    apiRequest<PaginatedResult<Instrument>>('/instruments', { query }),

  getInstrument: (id: string) => apiRequest<Instrument>(`/instruments/${id}`),

  listCourses: (query?: { instrumentId?: string; page?: number; limit?: number }) =>
    apiRequest<PaginatedResult<Course>>('/courses', { query }),

  getCourse: (id: string) => apiRequest<Course>(`/courses/${id}`),

  listCourseModules: (courseId: string, query?: { page?: number; limit?: number }) =>
    apiRequest<PaginatedResult<CourseModule>>(`/courses/${courseId}/modules`, { query }),

  listLessons: (moduleId: string, query?: { page?: number; limit?: number }) =>
    apiRequest<PaginatedResult<Lesson>>(`/modules/${moduleId}/lessons`, { query }),

  getLesson: (id: string) => apiRequest<Lesson>(`/lessons/${id}`),

  listLessonMaterials: (lessonId: string) =>
    apiRequest<PaginatedResult<LessonMaterial>>(`/lessons/${lessonId}/materials`),
};
