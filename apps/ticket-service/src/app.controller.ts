import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  BadRequestException,
  Delete,
} from '@nestjs/common';
import { CreateTicketDto } from './tickets/dto/create-ticket.dto';
import { PrismaService } from './prisma/prisma.service';
import { RabbitMQService } from './messaging/rabbitmq.service';
import { EventEnvelope } from './messaging/types/event.types';
import { randomUUID } from 'crypto';
@Controller()
export class AppController {
  constructor(
    private prisma: PrismaService,
    private rabbitmq: RabbitMQService,
  ) {}

  @Post('tickets')
  async createTicket(@Body() createTicketDto: CreateTicketDto) {
    if (!createTicketDto.subject) {
      throw new BadRequestException('Subject is required');
    }

    const ticket = await this.prisma.ticket.create({
      data: {
        subject: createTicketDto.subject,
        priority: createTicketDto.priority,
        status: 'PROCESSING',
      },
    });

    console.log('[TICKET CREATED]', ticket.id);

    const event: EventEnvelope = {
      event_id: randomUUID(),
      event_type: 'ticket.created',
      aggregate_id: ticket.id,
      tenant_id: 'default-tenant',
      timestamp: new Date().toISOString(),
      payload: {
        subject: ticket.subject,
        priority: ticket.priority,
      },
    };

    this.rabbitmq.publish('ticket.created', event);

    console.log('[EVENT PUBLISHED] ticket.created');

    return ticket;
  }

  @Get('tickets')
  async getTickets(@Query('status') status?: string) {
    return this.prisma.ticket.findMany({
      where: status ? { status } : {},
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  @Delete('tickets')
  async clearTickets() {
    await this.prisma.ticket.deleteMany();
    return { message: 'All tickets cleared' };
  }
}
