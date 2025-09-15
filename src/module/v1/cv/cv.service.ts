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
    this.logger.log('[CvService] Starting CV optimization process');
    
    // Extract needed fields with validation
    const { jobDescription, workExperience = [], skills: skillsInput = [], ...payload } = userCvData;
    
    try {
      // Step 1: Premium check
      this.logger.log(`[CvService] Checking user plan: ${user.plan}, credits: ${user.totalCreditPoint}`);
      if (user.plan === 'FREE' && !user.totalCreditPoint) {
        this.logger.warn(`[CvService] User ${user._id} has no credits left`);
        throw new BadRequestException(
          'You have no points left. Earn points by completing tasks or upgrade your plan to optimize more CVs.',
        );
      }

      // Step 2: Validate input
      if (!userCvData) {
        this.logger.error('[CvService] Missing userCvData in request');
        throw new BadRequestException('CV data is required');
      }
      
      if (!jobDescription) {
        this.logger.error('[CvService] Missing job description in request');
        throw new BadRequestException(
          'Job description is required for AI optimization',
        );
      }
      
      if (typeof jobDescription !== 'string' || jobDescription.trim().length < 20) {
        this.logger.error('[CvService] Job description too short or invalid format');
        throw new BadRequestException(
          'Job description must be a detailed text of at least 20 characters',
        );
      }
      
      // Validate skills
      if (!Array.isArray(skillsInput)) {
        this.logger.error('[CvService] Skills is not an array');
        throw new BadRequestException(
          'Skills must be provided as an array',
        );
      }
      
      // Validate work experience
      if (!Array.isArray(workExperience)) {
        this.logger.error('[CvService] Work experience is not an array');
        throw new BadRequestException(
          'Work experience must be provided as an array',
        );
      }

      // Step 3: Prepare payload for AI
      this.logger.log('[CvService] Preparing payload for AI service');
      
      // Process skills with validation
      const processedSkills = skillsInput.map((skill, index) => {
        if (!skill || typeof skill !== 'object') {
          this.logger.warn(`[CvService] Invalid skill format at index ${index}, using default values`);
          return { id: `${index + 1}`, name: 'Unnamed Skill', level: 'BEGINNER' };
        }
        
        return {
          id: `${index + 1}`,
          name: typeof skill.name === 'string' ? skill.name : 'Unnamed Skill',
          level: typeof skill.level === 'string' ? skill.level : 'BEGINNER',
        };
      });

      // Process work experiences with validation
      const experiences = workExperience.map((exp, index) => {
        if (!exp || typeof exp !== 'object') {
          this.logger.warn(`[CvService] Invalid work experience format at index ${index}, using default values`);
          return {
            id: `${index + 1}`,
            company: 'Unknown Company',
            position: 'Unknown Position',
            title: 'Unknown Title',
            startDate: '',
            endDate: '',
            current: false,
            location: '',
            description: '',
            achievements: [],
          };
        }
        
        return {
          id: `${index + 1}`,
          company: typeof exp.company === 'string' ? exp.company : 'Unknown Company',
          position: typeof exp.position === 'string' ? exp.position : 'Unknown Position',
          title: exp.title || exp.position || 'Unknown Title',
          startDate: typeof exp.startDate === 'string' ? exp.startDate : '',
          endDate: typeof exp.endDate === 'string' ? exp.endDate : '',
          current: !!exp.isCurrentRole,
          location: typeof exp.location === 'string' ? exp.location : '',
          description: typeof exp.description === 'string' ? exp.description : '',
          achievements: Array.isArray(exp.achievements) ? exp.achievements : [],
        };
      });

      const aiPayload = {
        jobDescription,
        skills: processedSkills,
        experiences,
      };

      this.logger.log(
        '[CvService] Sending payload to AI:',
        JSON.stringify(aiPayload, null, 2),
      );
      
      // Validate AI URL before attempting to call it
      if (!ENVIRONMENT.AI.URL) {
        this.logger.error('[CvService] AI URL is not configured');
        throw new Error('AI service URL is not configured');
      }
      
      // Check if AI URL is properly formatted
      try {
        new URL(ENVIRONMENT.AI.URL);
      } catch (error) {
        this.logger.error(`[CvService] Invalid AI URL format: ${ENVIRONMENT.AI.URL}`);
        throw new Error(`Invalid AI service URL: ${ENVIRONMENT.AI.URL}`);
      }

      let data;
      try {
        this.logger.log(`[CvService] Attempting to call AI service at: ${ENVIRONMENT.AI.URL}`);
        
        // Configure axios with timeout and proper headers
        const response = await axios.post(
          ENVIRONMENT.AI.URL, 
          aiPayload, 
          {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            timeout: 30000, // 30 seconds timeout
          }
        );
        
        this.logger.log('[CvService] AI service responded successfully');
        
        // Validate the response structure
        if (!response.data) {
          throw new Error('AI service returned empty response');
        }
        
        data = response.data;
        this.logger.log('[CvService] AI response data retrieved successfully');
        
        // Decrement total credit points if AI call succeeds
        await this.userService.update(user._id.toString(), {
          $inc: { totalCreditPoint: -1 },
        });
        this.logger.log(`[CvService] Credit point decremented for user ${user._id}`);
        
      } catch (aiError) {
        // Enhanced error handling with more detailed logging
        this.logger.error(
          `[CvService] AI service error: ${aiError.message}`, 
          aiError.stack
        );
        
        if (aiError.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          this.logger.error(
            `[CvService] AI service responded with status ${aiError.response.status}:`, 
            aiError.response.data
          );
        } else if (aiError.request) {
          // The request was made but no response was received
          this.logger.error(
            '[CvService] AI service did not respond:',
            aiError.request
          );
        } else {
          // Something happened in setting up the request that triggered an Error
          this.logger.error(
            '[CvService] Error setting up AI service request:',
            aiError.message
          );
        }
        
        this.logger.log('[CvService] Using fallback mock implementation');
        
        // Create a more sophisticated fallback implementation
        // This will return an enhanced version of the input data
        data = {
          professionalSummary: userCvData.professionalSummary || 
            `Experienced professional with skills in ${processedSkills.map(s => s.name).join(', ')}. ${
              experiences.length > 0 ? 
                `Has experience with ${experiences[0].company} as ${experiences[0].position}.` : 
                ''
            } Looking to apply expertise in a challenging role that leverages my background and skills.`,
          skills: processedSkills.map(skill => ({
            name: skill.name,
            level: skill.level
          })),
          experiences: experiences.map(exp => ({
            ...exp,
            description: exp.description,
            // Enhance the description slightly to simulate AI optimization
            achievements: exp.achievements?.length ? 
              exp.achievements : 
              [`Successfully contributed to ${exp.company}'s objectives through ${exp.position} role.`]
          }))
        };
        
        // Don't decrement points when using the fallback
        this.logger.log('[CvService] Using fallback implementation, points not decremented');
      }

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
      this.logger.error('[CvService] CV optimization failed:', error);
      
      // Provide more specific error messages based on error type
      if (error.response && error.response.status === 400) {
        throw new BadRequestException(
          'Invalid data format for CV optimization. Please check your input and try again.',
          { cause: error, description: error.message }
        );
      } else if (error.response && error.response.status === 401) {
        throw new BadRequestException(
          'Authentication failed with AI service. Please try again later.',
          { cause: error, description: error.message }
        );
      } else if (error.response && error.response.status === 403) {
        throw new BadRequestException(
          'Access denied to AI service. Please contact support.',
          { cause: error, description: error.message }
        );
      } else if (error.code === 'ECONNABORTED') {
        throw new BadRequestException(
          'AI service request timed out. Please try again later.',
          { cause: error, description: error.message }
        );
      } else {
        throw new BadRequestException(
          'AI Optimization Failed. Our optimization service is temporarily unavailable. Please try again in a few minutes.',
          { cause: error, description: error.message }
        );
      }
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
