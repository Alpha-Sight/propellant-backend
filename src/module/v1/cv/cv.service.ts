import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { existsSync, unlinkSync } from 'fs';
import { MailService } from '../mail /mail.service';
import {
  cvGeneratedEmailSubject,
  cvGeneratedEmailTemplate,
} from '../mail /templates/cv.template.email';
import { UserDocument } from '../user/schemas/user.schema';
import { ENVIRONMENT } from 'src/common/configs/environment';
import { GenerateCVDto } from './dto/cv.dto';
import { PDFHelper } from 'src/common/utils/pdf/pdf.util';
import { modernCVTemplate } from 'src/common/utils/pdf/templates/cv/modern.template';
import { CVTemplateEnum } from 'src/common/enums/cv.enum';
import { classicCVTemplate } from 'src/common/utils/pdf/templates/cv/classic.template';

@Injectable()
export class CvService {
  private readonly logger = new Logger(CvService.name);

  constructor(private mailService: MailService) {}

  async generateAndSendCV(
    user: UserDocument,
    payload: GenerateCVDto,
    template: CVTemplateEnum = CVTemplateEnum.CLASSIC,
  ) {
    if (!payload?.email || !payload.firstName || !payload.lastName) {
      throw new BadRequestException('Missing required fields');
    }

    const html =
      template === CVTemplateEnum.CLASSIC
        ? classicCVTemplate({
            ...user,
            ...payload,
            fullName: `${payload.firstName} ${payload.lastName}`,
          })
        : modernCVTemplate({
            ...user,
            ...payload,
            fullName: `${payload.firstName} ${payload.lastName}`,
          });

    const fileName = `${payload.firstName}_${payload.lastName}_CV.pdf`;
    const filePath = await PDFHelper.generatePDFfromHTML(html, fileName);

    await this.mailService.sendEmail(
      payload.email,
      cvGeneratedEmailSubject(payload.firstName),
      cvGeneratedEmailTemplate({
        firstName: payload.firstName,
        lastName: payload.lastName,
        hasBio: !!payload.professionalSummary,
        hasWorkExperience: !!payload.workExperience?.length,
        hasSkills: !!payload.skills?.length,
        hasCertifications: !!payload.certifications?.length,
        hasLanguages: !!payload.languages?.length,
        generatedDate: new Date().toLocaleDateString(),
        appName: ENVIRONMENT.APP.NAME,
      }),
      [
        {
          filename: fileName,
          path: filePath,
          contentType: 'application/pdf',
        },
      ],
    );

    if (existsSync(filePath)) unlinkSync(filePath);
    return { message: 'CV generated and sent successfully' };
  }
}
