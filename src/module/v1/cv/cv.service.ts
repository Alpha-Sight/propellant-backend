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
import { CV, CVDocument } from './schema/cv.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class CvService {
  private readonly logger = new Logger(CvService.name);
  private readonly AI_URL = 'https://ai-service-manager.fly.dev/cv-analysis';

  constructor(
    private mailService: MailService,
    private readonly httpService: HttpService,
    @InjectModel(CV.name)
    private cvModel: Model<CVDocument>,
  ) {}

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
        // hasLanguages: !!payload.languages?.length,
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

  async saveDraft(user: UserDocument, payload: GenerateCVDto) {
    const existingCv = await this.cvModel.findOne({ user: user._id });

    if (existingCv) {
      const updatedCv = await this.cvModel.findOneAndUpdate(
        { user: user._id },
        { $set: payload },
        { new: true },
      );
      return {
        data: updatedCv,
        message: 'CV draft updated successfully',
      };
    } else {
      const newCv = await this.cvModel.create({ user: user._id, ...payload });
      return {
        data: newCv,
        message: 'CV draft saved successfully',
      };
    }
  }

  async getDraft(user: UserDocument) {
    const draft = await this.cvModel.findOne({ user: user._id });
    return draft ?? {};
  }

  async optimizeCV(payload: GenerateCVDto): Promise<GenerateCVDto> {
    try {
      const inferredJobTitle =
        payload.workExperience?.[0]?.title || 'Professional';

      const inferredYearsOfExperience = payload.workExperience
        ? payload.workExperience.length
        : 0;

      const inferredCurrentRole =
        payload.workExperience?.[0]?.description || 'N/A';

      const inferredJobDescription =
        payload.workExperience?.[0]?.description || 'No description available';

      const { data } = await firstValueFrom(
        this.httpService.post(this.AI_URL, {
          job_title: inferredJobTitle,
          experience_years: inferredYearsOfExperience.toString(),
          skills: (payload.skills || []).map((s) => s.name).join(', '),
          current_role: inferredCurrentRole,
          job_description: inferredJobDescription,
          cv_text: payload.professionalSummary || '',
        }),
      );

      return {
        ...payload,
        professionalSummary: data.cv_text ?? payload.professionalSummary,
        workExperience: data.workExperience ?? payload.workExperience,
        skills: data.skills ?? payload.skills,
        certifications: data.certifications ?? payload.certifications,
      };
    } catch (err) {
      this.logger.error('AI Optimization Failed', err);
      return payload;
    }
  }

  async generateAndDownloadCV(
    user: UserDocument,
    payload: GenerateCVDto,
    template: CVTemplateEnum = CVTemplateEnum.CLASSIC,
  ): Promise<{
    success: boolean;
    message: string;
    buffer: Buffer;
    fileName: string;
  }> {
    if (!payload?.firstName || !payload.lastName) {
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

    const pdfBuffer = await PDFHelper.generatePDFBufferFromHTML(html);

    return {
      success: true,
      message: 'CV generated successfully',
      buffer: pdfBuffer,
      fileName,
    };
  }
}
