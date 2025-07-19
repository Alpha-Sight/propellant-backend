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
import { HttpService } from '@nestjs/axios';
import axios from 'axios';

@Injectable()
export class CvService {
  private readonly logger = new Logger(CvService.name);
  private readonly AI_URL = 'https://propellant.fly.dev/api/cv-analysis';

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

  // async optimizeCV(payload: GenerateCVDto): Promise<GenerateCVDto> {
  //   try {
  //     const { data } = await firstValueFrom(
  //       this.httpService.post(this.AI_URL, {
  //         skills: payload.skills || [],
  //         jobDescription: payload.professionalSummary || '',
  //         experiences: payload.workExperience || [],
  //       }),
  //     );

  //     return {
  //       ...payload,
  //       workExperience: data.experiences ?? payload.workExperience,
  //       skills: data.skills ?? payload.skills,
  //       professionalSummary: data.jobDescription ?? payload.professionalSummary,
  //     };
  //   } catch (err) {
  //     this.logger.error('AI Optimization Failed', err);
  //     return payload;
  //   }
  // }

  // import axios from 'axios';

  async optimizeCV(userCvData: any) {
    try {
      if (!userCvData) throw new Error('userCvData is required');

      // Ensure arrays exist
      const skillsInput = Array.isArray(userCvData.skills)
        ? userCvData.skills
        : [];
      const workInput = Array.isArray(userCvData.workExperience)
        ? userCvData.workExperience
        : [];

      // Map skills
      const skills = skillsInput.map((skill, index) => ({
        id: `${index}`,
        name: skill.name || '',
        level: skill.level || '',
      }));

      // Map experiences
      const experiences = workInput.map((exp, index) => ({
        id: `${index}`,
        company: exp.company || '',
        position: exp.position || '',
        startDate: exp.startDate || '',
        endDate: exp.endDate || '',
        current: !!exp.isCurrentRole,
        location: exp.location || '',
        description: exp.description || '',
        achievements: exp.achievements || [], // Pass if present, else empty
      }));

      // Prepare AI payload
      const aiPayload = {
        skills,
        jobDescription: userCvData.professionalSummary || '',
        experiences,
      };

      // Optional: Log payload for debugging
      console.log(
        '[CvService] Sending payload to AI:',
        JSON.stringify(aiPayload, null, 2),
      );

      // Send to AI service
      const { data } = await axios.post(
        'https://propellant.fly.dev/api/cv-analysis',
        aiPayload,
      );

      console.log('[CvService] AI optimization successful');
      return {
        ...userCvData,
        professionalSummary:
          data.professionalSummary ?? userCvData.professionalSummary,
        skills: (data.skills || []).map(({ name, level }) => ({ name, level })),
        workExperience: (data.experiences || []).map((exp) => ({
          company: exp.company,
          position: exp.position,
          startDate: exp.startDate,
          endDate: exp.endDate,
          isCurrentRole: exp.current,
          location: exp.location,
          description: exp.description,
          achievements: exp.achievements || [],
        })),
      };
    } catch (error) {
      console.error('[CvService] AI Optimization Failed', error.message);
      if (error.response) {
        console.error('[CvService] AI Error Response:', error.response.data);
      }
      throw new Error('AI Optimization failed. Please try again.');
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
