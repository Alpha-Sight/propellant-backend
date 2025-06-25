import { Module } from '@nestjs/common';
import { CvService } from './cv.service';
import { MailModule } from '../mail /mail.module';
import { CvController } from './cv.controller';

@Module({
  imports: [MailModule],
  controllers: [CvController],
  providers: [CvService],
})
export class CvModule {}
