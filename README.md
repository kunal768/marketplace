# Campus Marketplace

A high-performance, campus-exclusive marketplace platform designed for students to trade textbooks, gadgets, and essentials. This project implements a robust microservices architecture using **Go** and **Next.js**, featuring AI-powered search and real-time communication.

## 🖼️ System Design & Architecture
# Diagrams
![Project System Design](https://i.imgur.com/vmw49xm.png)
![Component Diagram](Project-Journal/uml-diagrams/Component%20Diagram%20-%20Campus%20Marketplace.png)
![Deployment Diagram](Project-Journal/uml-diagrams/Deployment%20Diagram%20-%20Campus%20Marketplace.png)

The platform is built on a distributed microservices architecture to ensure high availability and independent scalability:

## 🚀 Key Features

* **Microservices Architecture**: Independently scalable services for orchestration, listings, and real-time events.
* **AI-Powered Search**: Natural Language Processing via **Google Gemini API** to handle queries like *"looking for a used laptop under $500."*
* **Real-time Chat**: Full-duplex communication using **WebSockets** for buyer-seller negotiations.
* **Presence Tracking**: Real-time online/offline status management powered by **Redis**.
* **Reliable Messaging**: Asynchronous chat processing via **RabbitMQ** with persistent message status (Undelivered, Delivered, Read).
* **Listing Management**: Complete CRUD operations with cloud-based media storage via **Azure Blob Storage**.

## 🛠 Technology Stack

### Backend (Go)

* **Go 1.23+**: Core backend services (Orchestrator, Events, Listing).
* **PostgreSQL 16**: Relational storage for users and listings.
* **MongoDB 7**: Document-based storage for chat history.
* **Redis 7**: High-speed presence and message delivery tracking.
* **RabbitMQ 3**: Message broker for decoupled service communication.
* **Google Gemini API**: LLM integration for intelligent search parameters.

### Frontend (Next.js)

* **Next.js 16 / React 19**: Modern SSR framework.
* **TypeScript**: Type-safe frontend architecture.
* **Tailwind CSS 4**: Utility-first styling.
* **WebSocket API**: Bi-directional event handling for real-time features.

## 🏗 System Components

### 1. Orchestrator Service

The central API gateway handling authentication (JWT), session management, and request routing. It coordinates data flow between the frontend and internal services.

### 2. Events Server & Chat Consumer

Handles real-time logic. When a message is sent via **WebSocket**, it is published to **RabbitMQ**. The **Chat Consumer** then checks **Redis** for recipient presence:

* **Online:** Delivers the message immediately.
* **Offline:** Persists the message to **MongoDB** marked as "Undelivered" for later synchronization.

### 3. Listing Service

Manages the marketplace engine. It transforms natural language queries into structured database filters using the Gemini API and manages media uploads to **Azure Blob Storage**.

## 📁 Project Structure

```text
.
├── orchestrator/      # Central API gateway & Auth
├── listing-service/   # Listing & Search logic
├── events-server/     # WebSocket management
├── chat-consumer/     # Asynchronous message worker
├── frontend/          # Next.js web application
├── http-lib/          # Shared internal utilities
└── docker-compose.yml # Full-stack container orchestration

```

## 🚥 Quick Start

### Setup

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd campus-marketplace

```


2. **Environment Configuration**
Copy `.env.example` in each service directory and the root directory to `.env`. Provide your credentials for PostgreSQL, MongoDB, Redis, RabbitMQ, and the Gemini API.
3. **Deploy with Docker**
```bash
docker-compose up -d

```


4. **Access Points**
* **Web UI**: `http://localhost:3000`
* **API Gateway**: `http://localhost:8080`



## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
