import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MailService {
  constructor(private mailerService: MailerService) {}

  async sendEmail(
    toEmail: string,
    subject: string,
    template: string,
    attachments?: {
      filename: string;
      path: string;
      contentType?: string;
    }[],
  ) {
    // try {
    await this.mailerService.sendMail({
      to: toEmail,
      subject,
      html: template,
      attachments: [...(attachments || [])],
    });
    // } catch (e) {
    //   console.error('error sending email', e);
    // }
  }
}
