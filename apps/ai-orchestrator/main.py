import json
import pika
from fastapi import FastAPI
import threading
import random

app = FastAPI()

EXCHANGE = "support.events"
QUEUE = "ai.queue"
RETRY_QUEUE = "ai.retry.queue"
DLQ = "ai.dlq"

def classify_ticket(text: str):
    text = text.lower()

    # if "payment" in text or "billing" in text:
    #     return "billing", 0.92

    if "payment" in text or "billing" in text or "issue" in text:
        return "billing", 0.92

    if "login" in text or "password" in text:
        return "account", 0.88

    if "error" in text or "bug" in text:
        return "technical", 0.90

    if "urgent" in text or "asap" in text:
        return "urgent", 0.95

    return "general", 0.70

def start_consumer():
    connection = pika.BlockingConnection(
        pika.ConnectionParameters(
            host="localhost",
            credentials=pika.PlainCredentials("support_user", "support_password")
        )
    )

    channel = connection.channel()
    channel.exchange_declare(exchange=EXCHANGE, exchange_type="topic", durable=True)

    # DLQ
    channel.queue_declare(queue=DLQ, durable=True)

    # Retry Queue
    channel.queue_declare(
        queue=RETRY_QUEUE,
        durable=True,
        arguments={
            "x-dead-letter-exchange": EXCHANGE,
            "x-dead-letter-routing-key": "ticket.created",
            "x-message-ttl": 5000
        }
    )

    # Main Queue
    channel.queue_declare(
        queue=QUEUE,
        durable=True,
        arguments={
            "x-dead-letter-exchange": "",
            "x-dead-letter-routing-key": RETRY_QUEUE
        }
    )

    channel.queue_bind(exchange=EXCHANGE, queue=QUEUE, routing_key="ticket.created")

    # ✅ publisher
    def publish_ai_processed(event, category, confidence):
        response_event = {
            "event_id": event["event_id"],
            "event_type": "ticket.ai_processed",
            "aggregate_id": event["aggregate_id"],
            "tenant_id": event.get("tenant_id", "default-tenant"),
            "timestamp": event["timestamp"],
            "version": 1,
            "payload": {
                "category": category,
                "confidence": confidence
            }
        }

        channel.basic_publish(
            exchange=EXCHANGE,
            routing_key="ticket.ai_processed",
            body=json.dumps(response_event),
            properties=pika.BasicProperties(delivery_mode=2)
        )

        print("Published ticket.ai_processed")

    # ✅ callback (THIS WAS MISSING)
    def callback(ch, method, properties, body):
        try:
            event = json.loads(body)
            print("AI Service received:", event["event_type"])

            # simulate failure
            if random.random() < 0.3:  # 30% failure
                raise Exception("Simulated AI failure")

            # extract subject
            subject = event.get("payload", {}).get("subject", "")

            # classify
            category, confidence = classify_ticket(subject)

            print(f"[AI_PIPELINE] ticket={event['aggregate_id']} category={category} confidence={confidence}")

            publish_ai_processed(event, category, confidence)

            ch.basic_ack(delivery_tag=method.delivery_tag)

        except Exception as e:
            print("Processing failed:", str(e))
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

    # start consuming
    channel.basic_consume(queue=QUEUE, on_message_callback=callback)

    print("AI consumer started...")
    channel.start_consuming()

@app.on_event("startup")
def startup_event():
    thread = threading.Thread(target=start_consumer)
    thread.daemon = True
    thread.start()


@app.get("/")
def root():
    return {"status": "AI service running"}