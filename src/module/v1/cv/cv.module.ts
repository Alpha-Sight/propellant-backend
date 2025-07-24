import { Module } from '@nestjs/common';
import { CvService } from './cv.service';
import { MailModule } from '../mail/mail.module';
import { CvController } from './cv.controller';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { CV, CVSchema } from './schema/cv.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: CV.name, schema: CVSchema }]),
    HttpModule,
    MailModule,
  ],
  controllers: [CvController],
  providers: [CvService],
  exports: [CvService],
})
export class CvModule {}
