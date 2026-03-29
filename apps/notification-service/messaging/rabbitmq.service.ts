/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, OnModuleInit } from '@nestjs/common';
import { connect } from 'amqplib';

@Injectable()
export class RabbitMQService implements OnModuleInit {
  private connection: any;
  private channel: any;

  private readonly EXCHANGE = 'support.events';
  private readonly QUEUE = 'notification.queue';

  async onModuleInit(): Promise<void> {
    try {
      this.connection = await connect(
        'amqp://support_user:support_password@localhost:5672',
      );

      this.channel = await this.connection.createChannel();
      await this.channel.prefetch(1);

      await this.channel.assertExchange(this.EXCHANGE, 'topic', {
        durable: true,
      });

      await this.channel.assertQueue(this.QUEUE, {
        durable: true,
      });

      await this.channel.bindQueue(
        this.QUEUE,
        this.EXCHANGE,
        'ticket.ai_processed',
      );

      await this.channel.bindQueue(
        this.QUEUE,
        this.EXCHANGE,
        'ticket.ai_failed',
      );

      await this.channel.consume(this.QUEUE, async (msg: any) => {
        if (!msg) return;

        try {
          const event = JSON.parse(msg.content.toString());
          const ticketId = event.aggregate_id;

          if (event.event_type === 'ticket.ai_processed') {
            console.log(`
==============================
📩 NOTIFICATION SERVICE
✅ Ticket Classified
Ticket ID: ${ticketId}
Category: ${event.payload?.category}
Confidence: ${event.payload?.confidence}
==============================
      `);
          }

          if (event.event_type === 'ticket.ai_failed') {
            console.log(`
==============================
🚨 NOTIFICATION SERVICE
❌ Ticket Processing Failed
Ticket ID: ${ticketId}
Action: Manual review required
==============================
      `);
          }

          this.channel.ack(msg);
        } catch (error) {
          console.error('Notification processing failed:', error);

          // do NOT requeue → avoid infinite loops
          this.channel.nack(msg, false, false);
        }
      });

      console.log('Notification consumer started');
    } catch (error) {
      console.error('Notification RabbitMQ init failed:', error);
      throw error;
    }
  }
}
