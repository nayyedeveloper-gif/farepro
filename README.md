# Telegram Clone

A real-time messaging application built with Go backend and React frontend, featuring video/voice calls powered by LiveKit.

## Tech Stack

### Backend
- **Language**: Go 1.21+
- **Framework**: Gin (HTTP router)
- **Database**: PostgreSQL
- **Authentication**: JWT + bcrypt
- **Real-time**: WebSocket (Gorilla WebSocket)
- **Video/Voice**: LiveKit

### Frontend
- **Framework**: React with TypeScript + Vite
- **State Management**: React Context
- **Routing**: React Router
- **HTTP Client**: Axios
- **Real-time**: WebSocket (Gorilla WebSocket)
- **Video/Voice**: LiveKit Client SDK

## Project Structure

```
telegram-clone/
├── backend/
│   ├── cmd/
│   │   └── server/
│   │       └── main.go          # Main server entry point
│   ├── internal/
│   │   ├── auth/                # Authentication (JWT, password hashing)
│   │   ├── config/              # Configuration management
│   │   ├── handlers/            # HTTP handlers
│   │   ├── middleware/          # Middleware (auth, CORS)
│   │   ├── models/              # Data models
│   │   ├── repository/          # Database repositories
│   │   └── socket/              # WebSocket handling
│   ├── migrations/              # Database migrations
│   ├── go.mod
│   └── go.sum
└── frontend/
    ├── src/
    │   ├── components/          # React components
    │   │   ├── auth/            # Authentication components
    │   │   ├── messaging/       # Messaging components
    │   │   ├── calls/           # Video/voice call components
    │   │   └── common/          # Shared components
    │   ├── contexts/            # React contexts (Auth)
    │   ├── services/            # API services
    │   ├── types/               # TypeScript types
    │   ├── App.tsx              # Main app component
    │   └── App.css              # Global styles
    ├── package.json
    └── vite.config.ts
```

## Prerequisites

- Go 1.21+
- PostgreSQL 12+
- Node.js 18+ (for frontend)
- LiveKit server running on localhost:7880

## Backend Setup

### 1. Install Dependencies

```bash
cd backend
go mod download
```

### 2. Configure Environment

Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Server
PORT=8080
GIN_MODE=debug

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=telegram_clone
DB_SSLMODE=disable

# JWT
JWT_SECRET=your_jwt_secret_key_here_change_in_production
JWT_EXPIRATION=168h

# LiveKit
LIVEKIT_URL=http://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
```

### 3. Setup Database

Create PostgreSQL database:

```sql
CREATE DATABASE telegram_clone;
```

Run migrations:

```bash
psql -U postgres -d telegram_clone -f migrations/001_init_schema.sql
```

### 4. Build and Run

```bash
# Build
go build -o bin/server cmd/server/main.go

# Run
./bin/server
```

Or run directly:

```bash
go run cmd/server/main.go
```

The server will start on `http://localhost:8080`

## Frontend Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment

Create `.env` file in the frontend directory:

```env
VITE_API_URL=http://localhost:8080/api
```

### 3. Run Development Server

```bash
npm run dev
```

The frontend will start on `http://localhost:5173`

### 4. Build for Production

```bash
npm run build
```

The production build will be in the `dist` directory.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user (requires auth)
- `GET /api/auth/me` - Get current user (requires auth)

### Users
- `GET /api/users/search?q=query` - Search users (requires auth)
- `GET /api/users/:id` - Get user by ID (requires auth)
- `PUT /api/users/profile` - Update profile (requires auth)
- `POST /api/users/avatar` - Update avatar (requires auth)
- `POST /api/users/contacts` - Add contact (requires auth)
- `GET /api/users/contacts` - Get contacts (requires auth)
- `DELETE /api/users/contacts/:id` - Remove contact (requires auth)

### Messages
- `POST /api/messages/conversations` - Create conversation (requires auth)
- `GET /api/messages/conversations` - Get user conversations (requires auth)
- `GET /api/messages/conversations/:id/messages` - Get conversation messages (requires auth)
- `POST /api/messages/conversations/:id/messages` - Send message (requires auth)
- `PUT /api/messages/messages/:id` - Update message (requires auth)
- `DELETE /api/messages/messages/:id` - Delete message (requires auth)
- `POST /api/messages/conversations/:id/read` - Mark as read (requires auth)

### Calls
- `POST /api/calls/token` - Get LiveKit token (requires auth)
- `POST /api/calls/initiate` - Initiate call (requires auth)
- `POST /api/calls/:callId/join` - Join call (requires auth)
- `POST /api/calls/:callId/leave` - Leave call (requires auth)
- `POST /api/calls/:callId/end` - End call (requires auth)

### WebSocket
- `GET /ws` - WebSocket connection (requires auth token in header)

## LiveKit Setup

### Start LiveKit Server

```bash
cd /path/to/livekit
./livekit-server --dev
```

Or if you have the LiveKit CLI installed:

```bash
livekit-server --dev
```

The server will use:
- API Key: `devkey`
- API Secret: `secret`
- HTTP Port: 7880
- WebSocket URL: `ws://localhost:7880`

## Features

### Implemented
- ✅ User registration and authentication
- ✅ JWT-based authentication
- ✅ User search and contacts management
- ✅ Real-time messaging (REST API)
- ✅ WebSocket support for real-time updates
- ✅ Conversation management
- ✅ Video/voice call endpoints (LiveKit integration)
- ✅ Message read receipts
- ✅ Online/offline status tracking
- ✅ React frontend with TypeScript
- ✅ Authentication UI (login/register)
- ✅ Messaging UI components
- ✅ Responsive design

### To Be Implemented
- ⏳ File upload functionality
- ⏳ LiveKit SDK integration in frontend for video/voice calls
- ⏳ Real-time WebSocket integration in frontend
- ⏳ Push notifications
- ⏳ End-to-end encryption
- ⏳ Voice messages
- ⏳ Group calls
- ⏳ Message reactions
- ⏳ Typing indicators

## Development

### Running Tests

```bash
cd backend
go test ./...
```

### Code Style

This project follows Go best practices and clean architecture principles:
- Separation of concerns (handlers, repositories, models)
- Dependency injection
- Middleware for cross-cutting concerns
- Environment-based configuration

## Security Notes

- JWT secrets should be changed in production
- Use HTTPS in production
- Implement rate limiting
- Add input validation and sanitization
- Use environment variables for sensitive data
- Enable database SSL in production

## License

MIT License
