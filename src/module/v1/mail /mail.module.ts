import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailController } from './mail.controller';
import { MailerModule } from '@nestjs-modules/mailer';
import { MailProcessor } from './mail.processor';
import { join } from 'path';
import { ENVIRONMENT } from 'src/common/configs/environment';

@Global()
@Module({
  imports: [
    MailerModule.forRoot({
      transport: {
        service: ENVIRONMENT.SMTP.HOST,
        auth: {
          user: ENVIRONMENT.SMTP.EMAIL,
          pass: ENVIRONMENT.SMTP.PASSWORD,
        },
      },
      defaults: {
        from: `${ENVIRONMENT.SMTP.USER} <${ENVIRONMENT.SMTP.EMAIL}>`,
      },
      template: {
        dir: join(__dirname, 'templates'),
        options: {
          strict: true,
        },
      },
    }),
  ],
  controllers: [MailController],
  providers: [MailService, MailProcessor],
  exports: [MailService],
})
export class MailModule {}
