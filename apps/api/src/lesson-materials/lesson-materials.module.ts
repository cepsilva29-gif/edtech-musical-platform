import { Module } from '@nestjs/common';
import { LessonsModule } from '../lessons/lessons.module';
import { LessonMaterialsController } from './lesson-materials.controller';
import { LessonMaterialsService } from './lesson-materials.service';

@Module({
  imports: [LessonsModule],
  controllers: [LessonMaterialsController],
  providers: [LessonMaterialsService],
  exports: [LessonMaterialsService],
})
export class LessonMaterialsModule {}
