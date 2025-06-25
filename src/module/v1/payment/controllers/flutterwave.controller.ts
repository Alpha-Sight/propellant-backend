import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Public } from '../../../../common/decorators/public.decorator';
import { FlutterwaveService } from '../services/flutterwave.service';
import { Request } from 'express';
import { IFlutterwaveWebhookPayload } from '../../../../common/interfaces/flutterwave.interface';

@Controller('flutterwave')
export class FlutterwaveController {
  constructor(private readonly flutterwaveService: FlutterwaveService) {}

  @Public()
  @Post('process/hook/internal')
  async handleFlutterwaveWebhook(
    @Req() req: Request,
    @Body() body: IFlutterwaveWebhookPayload,
  ) {
    return await this.flutterwaveService.handleFlutterwaveWebhook(req, body);
  }

  @Public()
  @Get('process/internal/callback')
  async handleFlutterwaveCallback(@Req() req: Request) {
    this.flutterwaveService.handleFlutterwaveCallback(
      Number(req.query['transaction_id']),
    );
    return;
  }
}
