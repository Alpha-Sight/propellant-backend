import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { existsSync, unlinkSync } from 'fs';
import { MailService } from '../mail/mail.service';
import {
  cvGeneratedEmailSubject,
  cvGeneratedEmailTemplate,
} from '../mail/templates/cv.template.email';
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
import { UserService } from '../user/services/user.service';

@Injectable()
export class CvService {
  private readonly logger = new Logger(CvService.name);

  constructor(
    private mailService: MailService,
    private readonly httpService: HttpService,
    @InjectModel(CV.name)
    private cvModel: Model<CVDocument>,
    private userService: UserService,
  ) {}

  async generateAndSendCV(
    user: UserDocument,
    payload: GenerateCVDto,
    template: CVTemplateEnum = CVTemplateEnum.CLASSIC,
  ) {
    if (!payload?.email || !payload.firstName || !payload.lastName) {
      throw new BadRequestException('Missing required fields');
    }

    try {
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
    } catch (error) {
      throw new BadRequestException('Failed to generate and send CV');
    }
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

  async optimizeCV(user: UserDocument, userCvData: any) {
    const { jobDescription, ...payload } = userCvData;
    try {
      // Step 1: Premium check
      if (user.plan === 'FREE' && !user.totalCreditPoint)
        throw new BadRequestException(
          'You have no points left. Earn points by completing tasks or upgrade your plan to download more CVs.',
        );

      // Step 2: Validate input
      if (!userCvData) throw new Error('userCvData is required');
      if (!jobDescription)
        throw new BadRequestException(
          'Job description is required for AI optimization',
        );

      const skillsInput = Array.isArray(userCvData.skills)
        ? userCvData.skills
        : [];
      const workInput = Array.isArray(userCvData.workExperience)
        ? userCvData.workExperience
        : [];

      // Step 3: Prepare payload for AI
      const skills = skillsInput.map((skill, index) => ({
        id: `${index + 1}`,
        name: skill.name || '',
        level: skill.level || '',
      }));

      const experiences = workInput.map((exp, index) => ({
        id: `${index + 1}`,
        company: exp.company || '',
        position: exp.position || '',
        title: exp.title || exp.position || '',
        startDate: exp.startDate || '',
        endDate: exp.endDate || '',
        current: !!exp.isCurrentRole,
        location: exp.location || '',
        description: exp.description || '',
        achievements: exp.achievements || [],
      }));

      const aiPayload = {
        jobDescription,
        skills,
        experiences,
      };

      console.log(
        '[CvService] Sending payload to AI:',
        JSON.stringify(aiPayload, null, 2),
      );

      // Step 4: Send to AI
      const { data } = await axios.post(ENVIRONMENT.AI.URL, aiPayload);

      // Step 4: decrement total credit points
      await this.userService.update(user._id.toString(), {
        $inc: { totalCreditPoint: -1 },
      });

      // Step 5: Merge AI response into original user data
      return {
        ...payload,
        professionalSummary:
          data.professionalSummary || userCvData.professionalSummary,
        skills: (data.skills || []).map(({ name, level }) => ({ name, level })),
        workExperience: (data.experiences || []).map((exp) => ({
          company: exp.company,
          position: exp.position,
          title: exp.title,
          startDate: exp.startDate,
          endDate: exp.endDate,
          isCurrentRole: exp.current,
          location: exp.location,
          description: exp.description,
          achievements: exp.achievements || [],
        })),
      };
    } catch (error) {
      throw new BadRequestException(
        'AI Optimization Failed. Try again later',
        error.message,
      );
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

    if (user.plan === 'FREE' && !user.totalCreditPoint)
      throw new BadRequestException(
        'You have no points left. Earn points by completing tasks or upgrade your plan to download more CVs.',
      );

    try {
      const html =
        template === CVTemplateEnum.CLASSIC
          ? classicCVTemplate({
              ...user,
              ...payload,
              fullName: `${payload.firstName} ${payload.lastName}`,
              experience: payload.workExperience || [],
            })
          : modernCVTemplate({
              ...user,
              ...payload,
              fullName: `${payload.firstName} ${payload.lastName}`,
              experience: payload.workExperience || [],
            });

      const fileName = `${payload.firstName}_${payload.lastName}_CV.pdf`;

      const filePath = await PDFHelper.generatePDFfromHTML(html, fileName);

      const pdfBuffer = await PDFHelper.generatePDFBufferFromHTML(html);
      await this.userService.update(user._id.toString(), {
        $inc: { totalCvDownload: 1 },
      });

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

      await this.userService.update(user._id.toString(), {
        $inc: { totalCreditPoint: -1 },
      });

      return {
        success: true,
        message: 'CV generated and sent successfully',
        buffer: pdfBuffer,
        fileName,
      };
    } catch (error) {
      throw new BadRequestException(
        'Failed to generate and send CV. Try again',
      );
    }
  }
}
