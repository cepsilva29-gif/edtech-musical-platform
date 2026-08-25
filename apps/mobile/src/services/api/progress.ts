import type { CourseProgressSummary, LessonProgress, UpdateLessonProgressRequest } from 'shared';
import { apiRequest } from '../api-client';

export const progressApi = {
  getLessonProgress: (lessonId: string) =>
    apiRequest<LessonProgress>(`/lessons/${lessonId}/progress`),

  updateLessonProgress: (lessonId: string, body: UpdateLessonProgressRequest) =>
    apiRequest<LessonProgress>(`/lessons/${lessonId}/progress`, { method: 'PUT', body }),

  completeLesson: (lessonId: string) =>
    apiRequest<LessonProgress>(`/lessons/${lessonId}/progress/complete`, { method: 'POST' }),

  getCourseProgress: (courseId: string) =>
    apiRequest<CourseProgressSummary>(`/courses/${courseId}/progress`),
};
