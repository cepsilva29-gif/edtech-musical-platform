export interface LessonProgress {
  lessonId: string;
  watchedSeconds: number;
  lastPositionSeconds: number;
  isCompleted: boolean;
  completedAt: string | null;
}

export interface UpdateLessonProgressRequest {
  watchedSeconds: number;
  lastPositionSeconds: number;
}

export interface LessonProgressSummary {
  lessonId: string;
  title: string;
  durationSeconds: number;
  watchedSeconds: number;
  isCompleted: boolean;
}

export interface ModuleProgressSummary {
  moduleId: string;
  title: string;
  totalLessons: number;
  completedLessons: number;
  lessons: LessonProgressSummary[];
}

export interface CourseProgressSummary {
  courseId: string;
  totalLessons: number;
  completedLessons: number;
  percentComplete: number;
  modules: ModuleProgressSummary[];
}
