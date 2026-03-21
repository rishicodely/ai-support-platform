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

      await this.channel.consume(this.QUEUE, (msg: any) => {
        if (!msg) return;

        const event = JSON.parse(msg.content.toString());

        console.log('Notification Service received:', event.event_type);
        console.log('Payload:', event.payload);

        this.channel.ack(msg);
      });

      console.log('Notification consumer started');
    } catch (error) {
      console.error('Notification RabbitMQ init failed:', error);
      throw error;
    }
  }
}
