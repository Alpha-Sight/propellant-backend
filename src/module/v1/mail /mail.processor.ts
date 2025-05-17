import { Processor } from '@nestjs/bull';
import { MailService } from './mail.service';
import { QUEUE_CONSTANT } from '../../../common/constants/queue.constant';

@Processor(QUEUE_CONSTANT.EMAIL.name)
export class MailProcessor {
  constructor(private readonly mailService: MailService) {}
}
