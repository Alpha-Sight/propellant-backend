import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import { CvService } from './cv.service';
import { UserDocument } from '../user/schemas/user.schema';
import { LoggedInUserDecorator } from 'src/common/decorators/logged-in-user.decorator';
import { GenerateCVDto } from './dto/cv.dto';
import { CVTemplateEnum } from 'src/common/enums/cv.enum';
import { Response } from 'express';
import { ResponseMessage } from 'src/common/decorators/response.decorator';
import { RESPONSE_CONSTANT } from 'src/common/constants/response.constant';

@Controller('cv')
export class CvController {
  constructor(private readonly cvService: CvService) {}

  @Post('generate/:template')
  async generateCV(
    @LoggedInUserDecorator() user: UserDocument,
    @Body() payload: GenerateCVDto,
    @Param('template') template: CVTemplateEnum,
  ) {
    return this.cvService.generateAndSendCV(user, payload, template);
  }

  @Post('save-draft')
  async saveDraft(
    @LoggedInUserDecorator() user: UserDocument,
    @Body() payload: GenerateCVDto,
  ) {
    return this.cvService.saveDraft(user, payload);
  }

  @Get('draft')
  @ResponseMessage(RESPONSE_CONSTANT.CV.DRAFT_RETRIEVED_SUCCESS)
  async getDraft(@LoggedInUserDecorator() user: UserDocument) {
    return this.cvService.getDraft(user);
  }

  @Post('optimize')
  @ResponseMessage(RESPONSE_CONSTANT.CV.OPTIMIZED_SUCCESS)
  async optimizeCV(@Body() payload: GenerateCVDto) {
    return this.cvService.optimizeCV(payload);
  }

  @Post('download/:template')
  async downloadCV(
    @LoggedInUserDecorator() user: UserDocument,
    @Body() payload: GenerateCVDto,
    @Res() res: Response,
  ) {
    const { buffer, fileName } = await this.cvService.generateAndDownloadCV(
      user,
      payload,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': buffer.length,
    });

    return res.end(buffer);
  }
}
