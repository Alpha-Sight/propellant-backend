import { Body, Controller, Param, Post } from '@nestjs/common';
import { CvService } from './cv.service';
import { UserDocument } from '../user/schemas/user.schema';
import { LoggedInUserDecorator } from 'src/common/decorators/logged-in-user.decorator';
import { GenerateCVDto } from './dto/cv.dto';
import { CVTemplateEnum } from 'src/common/enums/cv.enum';

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
}
