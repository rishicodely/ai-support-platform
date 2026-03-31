/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, OnModuleInit } from '@nestjs/common';
import { connect, Connection, Channel } from 'amqplib';
import { EventEnvelope } from './types/event.types';
import dotenv from 'dotenv';

dotenv.config();

@Injectable()
export class RabbitMQService implements OnModuleInit {
  private connection!: Connection;
  private channel!: Channel;

  private readonly EXCHANGE = 'support.events';

  async onModuleInit(): Promise<void> {
    this.connection = await connect(process.env.RABBITMQ_URL);

    this.channel = await this.connection.createChannel();

    await this.channel.assertExchange(this.EXCHANGE, 'topic', {
      durable: true,
    });

    console.log('RabbitMQ connected');
  }

  publish(routingKey: string, event: EventEnvelope): void {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized');
    }

    this.channel.publish(
      this.EXCHANGE,
      routingKey,
      Buffer.from(JSON.stringify(event)),
      { persistent: true },
    );

    console.log('[EVENT PUBLISHED]', routingKey);
  }
}
