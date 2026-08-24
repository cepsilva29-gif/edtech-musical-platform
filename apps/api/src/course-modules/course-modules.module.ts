import { Module } from '@nestjs/common';
import { CoursesModule } from '../courses/courses.module';
import { CourseModulesController } from './course-modules.controller';
import { CourseModulesService } from './course-modules.service';

@Module({
  imports: [CoursesModule],
  controllers: [CourseModulesController],
  providers: [CourseModulesService],
  exports: [CourseModulesService],
})
export class CourseModulesModule {}
