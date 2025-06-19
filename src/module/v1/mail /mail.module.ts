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
        host: ENVIRONMENT.SMTP.HOST,
        port: 587, // Try port 587 with STARTTLS instead of 465 with SSL
        secure: false, // Use STARTTLS instead of SSL
        auth: {
          user: ENVIRONMENT.SMTP.EMAIL,
          pass: ENVIRONMENT.SMTP.PASSWORD,
        },
        tls: {
          rejectUnauthorized: false, // Accept all certificates
          ciphers: 'SSLv3', // Support older SSL protocols
          minVersion: 'TLSv1', // Try an older TLS version
        },
        debug: true, // Enable debugging output
      },
      defaults: {
        from:
          ENVIRONMENT.SMTP.FROM ||
          `"${ENVIRONMENT.APP.NAME}"
<${ENVIRONMENT.SMTP.EMAIL}>`,
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
