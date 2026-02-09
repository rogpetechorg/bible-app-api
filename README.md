# Bible App - Backend API

Node.js + Fastify + Prisma + PostgreSQL backend for the Bible App.

## Features

- User authentication (JWT)
- AI-powered chat (OpenAI/Anthropic)
- Reading plans and progress tracking
- Devotionals
- Stripe billing integration
- WebSocket support

## Environment Variables

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host:5432/database
JWT_SECRET=your-secret-key
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
STRIPE_SECRET_KEY=sk_test_...
```

## Development

```bash
# Install dependencies
pnpm install

# Run database migrations
pnpm db:migrate

# Seed database
pnpm db:seed

# Start development server
pnpm dev
```

## Production

```bash
# Build
pnpm build

# Start production server
pnpm start
```

## Docker

```bash
# Build image
docker build -t bible-app-api .

# Run container
docker run -p 3001:3001 --env-file .env bible-app-api
```

## API Endpoints

- `GET /health` - Health check
- `POST /api/auth/login` - User login
- `POST /api/auth/signup` - User registration
- `GET /api/users/me` - Get current user
- `POST /api/chat` - AI chat
- `GET /api/reading/plans` - Get reading plans
- More endpoints in source code...

## License

Private
