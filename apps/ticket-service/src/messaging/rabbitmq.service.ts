import { Injectable, OnModuleInit } from '@nestjs/common';
import { connect, Connection, Channel } from 'amqplib';
import { randomUUID } from 'crypto';

interface EventPayload {
  ticket_id: string;
  tenant_id?: string;
}

interface EventEnvelope {
  event_id: string;
  event_type: string;
  aggregate_id: string;
  tenant_id: string;
  timestamp: string;
  version: number;
  payload: EventPayload;
}

@Injectable()
export class RabbitMQService implements OnModuleInit {
  private connection!: Connection;
  private channel!: Channel;

  private readonly EXCHANGE = 'support.events';

  async onModuleInit(): Promise<void> {
    try {
      this.connection = await connect(
        `amqp://support_user:support_password@localhost:5672`,
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const channel: Channel = await this.connection.createChannel();
      this.channel = channel;
      await this.channel.assertExchange(this.EXCHANGE, 'topic', {
        durable: true,
      });

      console.log('RabbitMQ connected');
    } catch (error) {
      console.error('Failed to initialize RabbitMQ:', error);
      throw error;
    }
  }

  publish(eventType: string, payload: EventPayload): void {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized');
    }
    const event: EventEnvelope = {
      event_id: randomUUID(),
      event_type: eventType,
      aggregate_id: payload.ticket_id,
      tenant_id: payload.tenant_id ?? 'default-tenant',
      timestamp: new Date().toISOString(),
      version: 1,
      payload,
    };

    this.channel.publish(
      this.EXCHANGE,
      eventType,
      Buffer.from(JSON.stringify(event)),
      { persistent: true },
    );
    console.log('Event published:', eventType);
  }
}
