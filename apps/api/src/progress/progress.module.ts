import { Module } from '@nestjs/common';
import { AccessControlModule } from '../access-control/access-control.module';
import { CoursesModule } from '../courses/courses.module';
import { LessonsModule } from '../lessons/lessons.module';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';

@Module({
  imports: [LessonsModule, CoursesModule, AccessControlModule],
  controllers: [ProgressController],
  providers: [ProgressService],
})
export class ProgressModule {}
