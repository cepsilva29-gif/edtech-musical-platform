export type PublishStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type CourseLevel = 'INICIANTE' | 'INTERMEDIARIO' | 'AVANCADO';
export type MaterialType = 'PDF' | 'CIFRA' | 'PARTITURA' | 'EXERCICIO';

export interface Instrument {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  status: PublishStatus;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Course {
  id: string;
  instrumentId: string;
  teacherId: string | null;
  title: string;
  slug: string;
  description: string | null;
  level: CourseLevel;
  imageUrl: string | null;
  status: PublishStatus;
  order: number;
  createdAt: string;
  updatedAt: string;
  instrument: Instrument;
}

/** Entidade `Module` do schema (curso -> modulo -> aula). Renomeada para nao colidir com "module". */
export interface CourseModule {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  order: number;
  status: PublishStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  description: string | null;
  videoProvider: string | null;
  videoRef: string | null;
  durationSeconds: number;
  order: number;
  status: PublishStatus;
  createdAt: string;
  updatedAt: string;
}

export interface LessonMaterial {
  id: string;
  lessonId: string;
  type: MaterialType;
  title: string;
  storageKey: string;
  order: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Escrita (CRUD administrativo/professor - apps/admin, FASE 11)
// ---------------------------------------------------------------------------

export interface CreateInstrumentRequest {
  name: string;
  slug?: string;
  description?: string;
  iconUrl?: string;
  status?: PublishStatus;
  order?: number;
}

export type UpdateInstrumentRequest = Partial<CreateInstrumentRequest>;

export interface CreateCourseRequest {
  instrumentId: string;
  teacherId?: string;
  title: string;
  slug?: string;
  description?: string;
  level: CourseLevel;
  imageUrl?: string;
  status?: PublishStatus;
  order?: number;
}

export type UpdateCourseRequest = Partial<CreateCourseRequest>;

export interface CreateCourseModuleRequest {
  title: string;
  description?: string;
  status?: PublishStatus;
  order?: number;
}

export type UpdateCourseModuleRequest = Partial<CreateCourseModuleRequest>;

export interface CreateLessonRequest {
  title: string;
  description?: string;
  videoProvider?: string;
  videoRef?: string;
  durationSeconds?: number;
  status?: PublishStatus;
  order?: number;
}

export type UpdateLessonRequest = Partial<CreateLessonRequest>;

export interface CreateLessonMaterialRequest {
  type: MaterialType;
  title: string;
  storageKey: string;
  order?: number;
}

export type UpdateLessonMaterialRequest = Partial<CreateLessonMaterialRequest>;
