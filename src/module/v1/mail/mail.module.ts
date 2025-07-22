import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailController } from './mail.controller';
import { MailerModule } from '@nestjs-modules/mailer';
import { MailProcessor } from './mail.processor';
import { ENVIRONMENT } from 'src/common/configs/environment';
@Global()
@Module({
  imports: [
    MailerModule.forRoot({
      transport: {
        host: ENVIRONMENT.SMTP.HOST,
        port: +ENVIRONMENT.SMTP.PORT || 465,
        secure: false,
        auth: {
          user: ENVIRONMENT.SMTP.USER,
          pass: ENVIRONMENT.SMTP.PASSWORD,
        },
      },
      defaults: {
        from: `${ENVIRONMENT.APP.NAME} <${ENVIRONMENT.SMTP.EMAIL}>`,
      },
    }),
  ],
  controllers: [MailController],
  providers: [MailService, MailProcessor],
  exports: [MailService],
})
export class MailModule {}
