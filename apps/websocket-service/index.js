import dotenv from "dotenv";
dotenv.config();

import amqp from "amqplib";
import { Server } from "socket.io";
import http from "http";

const EXCHANGE = process.env.EXCHANGE || "support.events";
const QUEUE = process.env.QUEUE || "ws.queue";

async function start() {
  // 🌐 HTTP server
  const server = http.createServer();

  // 🔌 WebSocket server
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // 🐰 RabbitMQ
  let channel;

  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
  } catch (err) {
    console.error("❌ RabbitMQ connection failed", err);
    process.exit(1);
  }

  await channel.assertExchange(EXCHANGE, "topic", { durable: true });
  await channel.assertQueue(QUEUE, { durable: true });

  // 🔥 listen to AI results
  await channel.bindQueue(QUEUE, EXCHANGE, "ticket.ai_processed");
  await channel.bindQueue(QUEUE, EXCHANGE, "ticket.ai_failed");

  channel.consume(QUEUE, (msg) => {
    if (!msg) return;

    const event = JSON.parse(msg.content.toString());

    console.log("📡 WS EVENT:", event.event_type);

    // 🔥 emit to frontend
    const normalizedEvent = {
      ticketId: event.aggregate_id,
      status: event.payload?.status,
      category: event.payload?.category,
      aiConfidence: event.payload?.aiConfidence,
    };

    io.emit("ticket-updated", normalizedEvent);

    channel.ack(msg);
  });

  // client connect log
  io.on("connection", (socket) => {
    console.log("🔌 Client connected:", socket.id);

    socket.on("disconnect", () => {
      console.log("❌ Client disconnected:", socket.id);
    });
  });

  server.listen(4000, () => {
    console.log("WebSocket server running on port 4000");
  });
}

start();
