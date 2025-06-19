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
        ...(ENVIRONMENT.SMTP.SERVICE ? { service: ENVIRONMENT.SMTP.SERVICE } : {}), // Use service if provided
        host: ENVIRONMENT.SMTP.HOST,
        port: parseInt(ENVIRONMENT.SMTP.PORT as string) || 587, // Use port 587 by default
        secure: false, // false for STARTTLS (port 587)
        auth: {
          user: ENVIRONMENT.SMTP.USER,
          pass: ENVIRONMENT.SMTP.PASSWORD,
        },
        tls: {
          rejectUnauthorized: false, // Accept self-signed certificates
        },
        debug: process.env.NODE_ENV !== 'production', // Only enable debugging in non-production
      },
      defaults: {
        from: ENVIRONMENT.SMTP.FROM || `"${ENVIRONMENT.APP.NAME}" <${ENVIRONMENT.SMTP.EMAIL}>`,
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
