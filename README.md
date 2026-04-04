# 🚀 AI-Powered Support Ticket System

A production-style **event-driven microservices system** that automatically classifies support tickets using AI and updates the UI in real time.

---

## 🎯 Problem This Solves

Support teams often handle large volumes of tickets manually, leading to:

* Slow response times
* Incorrect routing of issues
* Poor user experience

This system automates **ticket classification and processing using AI**, improving efficiency and enabling real-time visibility.

---

## ✨ Overview

This project simulates how modern SaaS platforms (like Zendesk, Freshdesk) handle support workflows:

* Users create support tickets
* AI classifies them asynchronously
* System updates status in real-time
* Multiple services consume the same event stream

> Designed to demonstrate **scalable backend architecture**, not just CRUD functionality.

---

## 🧠 Key Features

* ⚡ Event-driven architecture (RabbitMQ)
* 🤖 AI-powered ticket classification (Groq LLM)
* 🔁 Retry + Dead Letter Queue (DLQ) handling
* 🌐 Real-time UI updates via WebSockets
* 🗄️ Persistent state with PostgreSQL (Neon)
* 🧩 Microservices-based design
* 🔄 Eventual consistency with DB as source of truth

---

## 🌐 Live Demo

* Frontend: https://ai-support-platform-seven.vercel.app
* Ticket API: https://ticket-service-nx7h.onrender.com

---

## 🏗️ Architecture

```text
Frontend (React)
        │
        ▼
Ticket Service (NestJS + Prisma)
        │
        ▼
   RabbitMQ (Event Bus)
        │
        ├──────────────► AI Service (Python - Groq)
        │                     │
        │                     ▼
        │             ticket.ai_processed
        │
        ├──────────────► Audit Service (Event Store)
        │
        ├──────────────► Notification Service
        │
        └──────────────► WebSocket Service
                              │
                              ▼
                       Real-time UI updates

        ▼
Ticket Service (consumes AI result → updates DB)
```

---

## 🧩 Microservices Breakdown

### 🟦 Ticket Service (Core)

* Handles ticket creation
* Stores data in PostgreSQL (Neon)
* Publishes `ticket.created`
* Consumes AI results to update DB (source of truth)

---

### 🟩 AI Service

* Consumes `ticket.created`
* Classifies using Groq LLM
* Publishes:

  * `ticket.ai_processed`
  * `ticket.ai_failed`
* Implements retry + DLQ handling

---

### 🟨 WebSocket Service

* Subscribes to event stream
* Emits real-time updates to frontend

---

### 🟪 Audit Service

* Logs all system events
* Enables traceability and debugging
* Acts as event store

---

### 🟥 Notification Service

* Subscribes to critical events
* Designed for alerts, emails, escalation workflows

---

## 🔄 Event Flow

### 1. Ticket Creation

* User creates ticket
* Stored in DB with `PROCESSING` status
* Event published → `ticket.created`

---

### 2. AI Processing

* AI service consumes event
* Classifies ticket
* Publishes:

  * `ticket.ai_processed` ✅
  * `ticket.ai_failed` ❌

---

### 3. Database Update

* Ticket service consumes AI result
* Updates DB:

  * `CLASSIFIED` + category + confidence
  * or `FAILED`

---

### 4. Real-Time Update

* WebSocket service emits update
* Frontend updates instantly

---

## 📦 Event Contract

### ticket.created

```json
{
  "event_type": "ticket.created",
  "aggregate_id": "ticket_id",
  "payload": {
    "status": "PROCESSING",
    "subject": "...",
    "priority": "..."
  }
}
```

---

### ticket.ai_processed

```json
{
  "event_type": "ticket.ai_processed",
  "aggregate_id": "ticket_id",
  "payload": {
    "status": "CLASSIFIED",
    "category": "technical",
    "confidence": 0.95
  }
}
```

---

### ticket.ai_failed

```json
{
  "event_type": "ticket.ai_failed",
  "aggregate_id": "ticket_id"
}
```

---

## 🧰 Tech Stack

### 🖥️ Frontend

* React (Vite)
* Socket.IO client
* Tailwind CSS

---

### 🧠 Backend

#### Ticket Service

* NestJS
* Prisma ORM
* PostgreSQL (Neon)
* RabbitMQ

#### AI Service

* Python
* Groq API
* RabbitMQ

#### WebSocket Service

* Node.js
* Socket.IO

---

### ⚙️ Infrastructure

* RabbitMQ
* Docker
* Neon (serverless Postgres)
* Render (backend deployment)
* Vercel (frontend deployment)

---

## 🖼️ Screenshots

<img width="1920" height="1080" alt="Screenshot from 2026-04-04 15-58-57" src="https://github.com/user-attachments/assets/a1c77720-c2ef-4ac4-a6b0-c2efcfe0f22d" />

---

## 🧠 Key Design Decisions

* Used RabbitMQ to decouple services and enable scalability
* Maintained Ticket Service as **single source of truth**
* Used WebSocket for real-time updates instead of polling
* Implemented retry + DLQ to handle failures safely
* Designed system for multiple independent consumers

---

## ⚠️ Challenges Solved

### Event Contract Consistency

* Missing fields caused UI inconsistencies
* Fixed by enforcing structured payloads

---

### Distributed Debugging

* Debugged across:

  * Vercel (frontend)
  * Render (backend)
  * Neon (DB)
  * RabbitMQ

---

### Eventual Consistency

* Ensured DB reflects final state
* UI reflects real-time updates

---

### Failure Handling

* Prevented infinite retries
* Used DLQ for safe failure management

---

## 🚀 Local Setup

### Start Infrastructure

```bash
docker-compose up
```

---

### Start Services

#### Ticket Service

```bash
cd ticket-service
npm install
npm run start:dev
```

#### AI Service

```bash
cd ai-orchestrator
pip install -r requirements.txt
python main.py
```

#### WebSocket Service

```bash
cd websocket-service
npm install
node index.js
```

#### Frontend

```bash
cd support-ui
npm install
npm run dev
```

---

## 🌍 Environment Variables

```env
RABBITMQ_URL=amqp://user:pass@localhost:5672
DATABASE_URL=postgresql://...
FRONTEND_URL=http://localhost:5173
EXCHANGE=support.events
```

---

## 💡 Future Improvements

* 🔐 Authentication & multi-tenant support
* 📊 Analytics dashboard
* 📩 Email / Slack notifications
* 🧾 Ticket history timeline
* 🤖 Improved AI models

---

## 👩‍💻 Author

**Rishika Reddy**

* Backend & MERN Developer
* Exploring AI + System Design
* Building production-style systems

---

## ⭐ Final Note

This project demonstrates how real-world systems are built using:

* Event-driven architecture
* Microservices
* Asynchronous processing
* Real-time communication

---
