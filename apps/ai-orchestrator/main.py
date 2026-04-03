import json
import os
from unicodedata import category
from unittest import result
import urllib.parse
import pika
from fastapi import FastAPI
import threading
import random
from dotenv import load_dotenv
import re
from groq import Groq

load_dotenv()

app = FastAPI()

EXCHANGE = "support.events"
QUEUE = "ai.queue.v2"
RETRY_QUEUE = "ai.retry.queue"
DLQ = "ai.dlq"

api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    raise Exception("GROQ_API_KEY missing")

client = Groq(api_key=api_key)

def classify_with_groq(text: str):
    response = client.chat.completions.create(
        model="llama3-8b-8192",
        messages=[
            {
                "role": "system",
                "content": """
You are a support ticket classifier.

Classify into:
billing, account, technical, urgent, general

Respond ONLY with valid JSON.
No explanation, no extra text.

Example:
{"category": "billing", "confidence": 0.92}
"""
            },
            {"role": "user", "content": text}
        ],
        temperature=0
    )

    content = response.choices[0].message.content

    print("🚀 USING GROQ")
    print("RAW:", content)

    try:
        content = re.sub(r"```json|```", "", content).strip()

        print("CLEANED:", content)

        json_match = re.search(r"\{.*\}", content, re.DOTALL)

        if not json_match:
            raise Exception("No JSON found")

        json_str = json_match.group(0)

        result = json.loads(json_str)

        category = result.get("category", "general")
        confidence = float(result.get("confidence", 0.5))

        print("FINAL PARSED:", category, confidence)

        return category, confidence

    except Exception as e:
        print("❌ PARSE ERROR:", e)
        print("BAD CONTENT:", content)
        return "general", 0.5
    
def start_consumer():
    try:
        url = os.getenv("RABBITMQ_URL")
        if not url:
            raise Exception("RABBITMQ_URL missing")

        params = pika.URLParameters(url)
        params.heartbeat = 600
        params.blocked_connection_timeout = 300

        connection = pika.BlockingConnection(params)
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
                "x-message-ttl": 5000,
            },
        )

        # Main Queue
        channel.queue_declare(
            queue=QUEUE,
            durable=True,
            arguments={
                "x-dead-letter-exchange": "",
                "x-dead-letter-routing-key": RETRY_QUEUE,
            },
        )

        channel.queue_bind(exchange=EXCHANGE, queue=QUEUE, routing_key="ticket.*")

    except Exception as e:
        print("🔥 RABBIT INIT FAILED:", e)
        return
    
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
            headers = properties.headers or {}
            x_death = headers.get("x-death", [])
            retry_count = x_death[0]["count"] if x_death else 0

            if retry_count >= 3:
                print("Max retries reached → dropping message")
                failure_event = {
                    "event_id": event["event_id"],
                    "event_type": "ticket.ai_failed",
                    "aggregate_id": event["aggregate_id"],
                    "tenant_id": event.get("tenant_id", "default-tenant"),
                    "timestamp": event["timestamp"],
                    "version": 1,
                    "payload": {}
                }

                channel.basic_publish(
                    exchange=EXCHANGE,
                    routing_key="ticket.ai_failed",
                    body=json.dumps(failure_event),
                    properties=pika.BasicProperties(delivery_mode=2)
               )
                
                ch.basic_ack(delivery_tag=method.delivery_tag)
                return
            
            print("AI Service received:", event["event_type"])
            print(f"[RETRY {retry_count}] Processing ticket {event['aggregate_id']}")

            # extract subject
            subject = event.get("payload", {}).get("subject", "")

            # classify
            try:
                category, confidence = classify_with_groq(subject)
            except Exception:
                category, confidence = "general", 0.5

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