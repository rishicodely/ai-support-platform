import { Controller, Post, Body, Get } from '@nestjs/common';
import { CreateTicketDto } from './tickets/dto/create-ticket.dto';
import { PrismaService } from './prisma/prisma.service';
import { RabbitMQService } from './messaging/rabbitmq.service';

@Controller()
export class AppController {
  constructor(
    private prisma: PrismaService,
    private rabbitmq: RabbitMQService,
  ) {}

  @Post('tickets')
  async createTicket(@Body() createTicketDto: CreateTicketDto) {
    const ticket = await this.prisma.ticket.create({
      data: {
        subject: createTicketDto.subject,
        priority: createTicketDto.priority,
      },
    });

    this.rabbitmq.publish('ticket.created', {
      ticket_id: ticket.id,
    });

    return ticket;
  }
  @Get('tickets')
  async getTickets() {
    return this.prisma.ticket.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
