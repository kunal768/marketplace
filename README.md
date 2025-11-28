[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/VM5AL9S5)

# Campus Marketplace - Phantom

A campus-only marketplace platform similar to Facebook Marketplace, designed exclusively for students to buy and sell textbooks, gadgets, essentials, and non-essentials within their campus community.

![Project System Design](https://i.imgur.com/vmw49xm.png)

## Team Information

**Team Name:** Phantom

**Team Members:**
- Kunal Keshav Singh Sahni (kunal768)
- Nikhil Raj Singh (Nikhil1169)
- Dan Lam (danlam-sudo)

## Project Overview

Campus Marketplace is a full-stack microservices application that enables students to create listings, search for items using natural language queries, negotiate through real-time chat, and manage their marketplace interactions. The platform includes role-based access for Sellers, Buyers, and Admins with comprehensive moderation capabilities.

### Key Features

- **Listing Management**: Create and manage listings with photos, categories, and pricing
- **Natural Language Search**: AI-powered search using Google Gemini API to understand queries like "do you have a textbook for cmpe202?"
- **Real-time Chat**: WebSocket-based messaging system for buyer-seller negotiations
- **Presence Management**: Track online/offline status of users
- **Message Persistence**: Store chat messages with delivery status (Undelivered, Delivered, Read)
- **Admin Moderation**: Report incomplete listings, flag inappropriate content, and manage users
- **Category Filtering**: Filter by category (Textbook, Gadget, Essential, Non-Essential, Other) and price range
- **User Profiles**: View and edit user profiles, manage personal listings

## Technology Stack

### Backend Services (Go)
- **Go 1.23+**: Primary backend language
- **PostgreSQL 16**: Primary relational database for users and listings
- **MongoDB 7**: Document database for chat message persistence
- **Redis 7**: In-memory store for presence management and message delivery
- **RabbitMQ 3**: Message queue for asynchronous chat message processing
- **Google Gemini API**: Natural language processing for intelligent search
- **Azure Blob Storage**: Cloud storage for listing media/images

### Frontend (Next.js)
- **Next.js 16**: React framework with App Router
- **React 19**: UI library
- **TypeScript**: Type-safe development
- **Tailwind CSS 4**: Utility-first CSS framework
- **Radix UI**: Accessible component primitives
- **WebSocket API**: Real-time communication with events server

### Infrastructure & DevOps
- **Docker & Docker Compose**: Containerization and local development
- **Microservices Architecture**: Service-oriented design with independent services
- **RESTful APIs**: JSON-based API communication
- **WebSocket**: Bi-directional real-time communication

## System Architecture

The application follows a microservices architecture with the following components:

### Core Services

1. **Orchestrator Service** (`orchestrator/`)
   - Central API gateway and request router
   - Handles authentication and authorization
   - Coordinates between frontend and backend services
   - Manages user sessions and JWT tokens
   - Pulls undelivered messages from MongoDB and enqueues them for sync

2. **Listing Service** (`listing-service/`)
   - Manages listing CRUD operations
   - Handles image/media uploads to Azure Blob Storage
   - Integrates with Google Gemini API for natural language search
   - Provides filtering and search capabilities

3. **Events Server** (`events-server/`)
   - WebSocket server for real-time communication
   - Manages client connections and presence
   - Validates authentication through orchestrator
   - Publishes incoming chat messages to RabbitMQ
   - Delivers messages directly to online clients

4. **Chat Consumer** (`chat-consumer/`)
   - Background worker consuming messages from RabbitMQ
   - Checks recipient presence via Redis
   - Persists messages to MongoDB with delivery status
   - Marks messages as undelivered if recipient is offline

5. **Frontend** (`frontend/`)
   - Next.js web application
   - User interface for all roles (Seller, Buyer, Admin)
   - Real-time chat interface
   - AI-powered search interface
   - Admin dashboard for moderation

### Data Storage

- **PostgreSQL**: Users, listings, flagged listings, user authentication
- **MongoDB**: Chat messages with status tracking
- **Redis**: User presence (online/offline status)
- **Azure Blob Storage**: Listing images and media files

### Message Flow

1. Client sends message → Events Server (WebSocket)
2. Events Server → RabbitMQ Queue
3. Chat Consumer → Checks Redis for recipient presence
4. If offline → Persist to MongoDB as "Undelivered"
5. If online → Deliver via Events Server WebSocket
6. On login → Orchestrator pulls undelivered messages and enqueues for sync

## Project Structure

```
.
├── orchestrator/          # Central API gateway service
├── listing-service/       # Listing management service
├── events-server/         # WebSocket server for real-time events
├── chat-consumer/         # Background worker for message processing
├── frontend/              # Next.js web application
├── http-lib/              # Shared HTTP utilities
├── database/              # SQL schema and seed data
├── docker-compose.yml     # Local development orchestration
└── Makefile              # Development commands
```

## Setup Instructions

### Prerequisites

- Docker and Docker Compose
- Go 1.23+ (for local development)
- Node.js 18+ and pnpm (for frontend development)
- Environment variables configured (see `.env.example` files)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd cmpe202-02-team-project-phantom
   ```

2. **Configure environment variables**
   - Copy `.env.example` files in root and `listing-service/` directories
   - Create `.env` files matching the example variables
   - Configure required services:
     - PostgreSQL connection details
     - MongoDB URI
     - Redis connection
     - RabbitMQ URL
     - Google Gemini API key
     - Azure Blob Storage credentials

3. **Start all services**
   ```bash
   make up
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Orchestrator API: http://localhost:8080
   - Listing Service: http://localhost:8081
   - Events Server (WebSocket): ws://localhost:8001
   - RabbitMQ Management: http://localhost:15672

### Development Commands

```bash
# Start all services
make up

# Stop all services
make down

# View logs
make log-or    # Orchestrator logs
make log-ls    # Listing service logs
make log-fr    # Frontend logs
make log-es    # Events server logs
make log-cc    # Chat consumer logs

# Database access
make psql      # PostgreSQL shell
make redis     # Redis CLI
make mongo     # MongoDB shell
```

## API Documentation

### Listing Service
- Postman collection available: `listing-service/Listings.postman_collection.json`
- Base URL: `http://localhost:8081` (configurable via `LISTING_PORT`)

### Orchestrator Service
- Postman collection available: `orchestrator/postman_collection.json`
- Base URL: `http://localhost:8080` (configurable via `ORCHESTRATOR_PORT`)

## Team Contributions

### Kunal Keshav Singh Sahni (kunal768)
- **Backend Architecture**: Orchestrator service design and implementation
- **Chat System**: Real-time messaging infrastructure, WebSocket integration
- **Message Persistence**: MongoDB integration for chat storage
- **User Management**: User search APIs and authentication flows
- **Database Design**: Schema design and migrations
- **Bug Fixes**: Real-time chat message delivery fixes, UUID-based search implementation
- **DevOps**: Docker configurations and service orchestration

### Nikhil Raj Singh (Nikhil1169)
- **Frontend Integration**: WebSocket connection management and real-time chat UI
- **AI Search Integration**: Natural language search interface and AI chatbot component
- **Navigation**: Search bar integration and navigation improvements
- **Messaging System**: Complete messaging/chatting functionality implementation
- **UI Components**: Chat interface components and user experience improvements

### Dan Lam (danlam-sudo)
- **Frontend Development**: Complete frontend application architecture
- **Listing Management**: Create, edit, delete listings with media upload
- **Admin Dashboard**: Admin user management, flagged listings management
- **Reporting System**: Flagging and reporting features (frontend and backend)
- **Profile Management**: User profile views, edit functionality, personal listings
- **Home Page**: Category counts, featured listings, category navigation
- **UI/UX**: Price range filters, sequential AI chat, search improvements
- **Database Seeding**: Seed data generation for testing

## Project Artifacts

- **Project Journal**: [Project-Journal/Weekly Scrum Report.md](./Project-Journal/Weekly%20Scrum%20Report.md)
- **Project Board/Backlog**: [Link to Google Sheet or Project Board](#) *(To be added)*
- **System Architecture Diagram**: [View Diagram](https://i.imgur.com/vmw49xm.png)

## Design Decisions

### Microservices Architecture
- **Rationale**: Separation of concerns allows independent scaling and deployment
- **Benefits**: Each service can be developed, tested, and deployed independently

### Natural Language Search
- **Technology**: Google Gemini API (Gemini 2.5 Flash)
- **Rationale**: Provides intelligent query understanding without complex NLP infrastructure
- **Implementation**: Converts natural language queries to structured search parameters

### Real-time Communication
- **WebSocket**: Bi-directional communication for instant messaging
- **Message Queue**: RabbitMQ ensures reliable message delivery
- **Presence Management**: Redis provides fast online/offline status checks

### Database Choices
- **PostgreSQL**: Relational data (users, listings) requiring ACID guarantees
- **MongoDB**: Chat messages benefit from document storage and flexible schema
- **Redis**: Fast in-memory operations for presence and caching

## Development Practices

- **Scrum Methodology**: 6 sprints of 2 weeks each
- **Git Workflow**: Feature branches with pull request reviews
- **Code Quality**: Type safety with Go and TypeScript
- **API Design**: RESTful JSON APIs with comprehensive error handling
- **Testing**: Manual testing with Postman collections

## Future Enhancements

- Payment integration
- Email notifications
- Mobile application
- Advanced search filters
- Recommendation system
- Analytics dashboard

## License

This project is developed for CMPE 202 course requirements.

## Contact

For questions or issues, please contact the team members or create an issue in the repository.
