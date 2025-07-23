import { BadRequestException, Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { Waitlist } from './schema/waitlist.schema';
import { InjectModel } from '@nestjs/mongoose';
import { JoinWaitlistDto } from './dto/waitlist.dto';
import { RepositoryService } from '../repository/repository.service';
import { PaginationDto } from '../repository/dto/repository.dto';
import { EMAIL_CONSTANT } from '../../../common/constants/email.constant';
import { MailService } from '../mail/mail.service';
import { waitlistConfirmationEmailTemplate } from '../mail/templates/waitlist-confirmation.email';

@Injectable()
export class WaitlistService {
  constructor(
    @InjectModel(Waitlist.name) private waitlistModel: Model<Waitlist>,
    private repositoryService: RepositoryService,
    private mailService: MailService,
  ) {}

  async joinWaitlist(payload: JoinWaitlistDto) {
    const userJoinedAlready = await this.waitlistModel.exists({
      email: payload.email,
    });

    if (userJoinedAlready) {
      throw new BadRequestException('You have already joined the waitlist');
    }

    const waitlistEntry = await this.waitlistModel.create(payload);

    const interests = Array.isArray(payload.interest)
      ? payload.interest
      : [payload.interest];

    // Send confirmation email
    await this.mailService.sendEmail(
      payload.email,
      `Welcome to ${EMAIL_CONSTANT.appName} Waitlist`,
      waitlistConfirmationEmailTemplate({
        fullName: payload.fullName,
        interest: interests,
        appName: EMAIL_CONSTANT.appName,
      }),
    );

    return waitlistEntry;
  }

  async allEntries(query: PaginationDto) {
    return this.repositoryService.paginate({
      model: this.waitlistModel,
      query,
    });
  }
}
