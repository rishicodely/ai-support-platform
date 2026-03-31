/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Injectable, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import { PrismaService } from '../prisma/prisma.service';
import dotenv from 'dotenv';

dotenv.config();

@Injectable()
export class AIConsumer implements OnModuleInit {
  private connection: any;
  private channel: any;

  private readonly EXCHANGE = 'support.events';
  private readonly QUEUE = 'ticket.result.queue';

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    this.connection = await amqp.connect(process.env.RABBITMQ_URL);

    this.channel = await this.connection.createChannel();

    await this.channel.assertExchange(this.EXCHANGE, 'topic', {
      durable: true,
    });

    await this.channel.assertQueue(this.QUEUE, { durable: true });

    await this.channel.bindQueue(
      this.QUEUE,
      this.EXCHANGE,
      'ticket.ai_processed',
    );

    await this.channel.bindQueue(this.QUEUE, this.EXCHANGE, 'ticket.ai_failed');

    await this.channel.consume(this.QUEUE, async (msg: any) => {
      if (!msg) return;

      try {
        const event = JSON.parse(msg.content.toString());

        console.log('Ticket Service received:', event.event_type);

        const ticketId = event.aggregate_id;

        // ✅ HANDLE FAILURE FIRST
        if (event.event_type === 'ticket.ai_failed') {
          await this.prisma.ticket.update({
            where: { id: ticketId },
            data: {
              status: 'FAILED',
            },
          });

          console.log(`Ticket ${ticketId} marked FAILED`);

          this.channel.ack(msg);
          return;
        }

        // ✅ SUCCESS CASE
        const category = event?.payload?.category ?? null;
        const confidence = event?.payload?.confidence ?? null;

        await this.prisma.ticket.update({
          where: { id: ticketId },
          data: {
            category,
            aiConfidence: confidence,
            status: 'CLASSIFIED',
          },
        });

        console.log(`Ticket ${ticketId} updated with AI result`);

        this.channel.ack(msg);
      } catch (err) {
        console.error('Failed to process AI result', err);

        this.channel.nack(msg, false, true);
      }
    });
    console.log('AI consumer started in ticket-service');
  }
}
