import amqp from "amqplib";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

const EXCHANGE = "support.events";
const QUEUE = "audit.queue";

async function start() {
  const connection = await amqp.connect(process.env.RABBITMQ_URL!);
  const channel = await connection.createChannel();

  await channel.assertExchange(EXCHANGE, "topic", { durable: true });
  await channel.assertQueue(QUEUE, { durable: true });

  // 🔥 listen to ALL ticket events
  await channel.bindQueue(QUEUE, EXCHANGE, "ticket.*");

  await channel.consume(QUEUE, async (msg) => {
    if (!msg) return;

    try {
      const event = JSON.parse(msg.content.toString());

      await prisma.auditLog.create({
        data: {
          eventType: event.event_type,
          ticketId: event.aggregate_id,
        },
      });

      console.log(
        `📜 AUDIT: ${event.event_type} | Ticket: ${event.aggregate_id} | Time: ${new Date().toISOString()}`,
      );

      channel.ack(msg);
    } catch (err) {
      console.error("Audit error:", err);
      channel.nack(msg, false, false);
    }
  });

  console.log("Audit service started...");
}

start();
