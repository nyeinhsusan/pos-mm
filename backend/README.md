# POS Myanmar - Backend API

Node.js + Express REST API for POS Myanmar system.

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Database Setup

#### Create Database
```bash
# Connect to MySQL
mysql -u root -p

# Run schema script
source /Users/nyeinhsusan/Documents/leaptechnology/pos-mm/database/schema.sql

# Run seed data (creates test accounts)
source /Users/nyeinhsusan/Documents/leaptechnology/pos-mm/database/seed.sql
```

Alternatively, you can run:
```bash
mysql -u root -p < ../database/schema.sql
mysql -u root -p < ../database/seed.sql
```

### 3. Configure Environment
The `.env` file has been created. Update the following if needed:
- `DB_PASSWORD` - Your MySQL root password
- `DB_USER` - MySQL username (default: root)
- `JWT_SECRET` - Change in production!

### 4. Start Server

Development mode (with auto-restart):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## Test Accounts

### Owner Account
- **Email:** owner@pos.com
- **Password:** owner123
- **Role:** owner
- **Permissions:** Full access (can create users, products, view reports)

### Cashier Account
- **Email:** cashier@pos.com
- **Password:** cashier123
- **Role:** cashier
- **Permissions:** Can record sales only

## API Endpoints

### Health Check
```
GET /health
```

### Authentication

#### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "owner@pos.com",
  "password": "owner123"
}
```

#### Register (Owner only)
```
POST /api/auth/register
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "newuser@pos.com",
  "password": "password123",
  "full_name": "New User",
  "role": "cashier"
}
```

## Testing with cURL

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@pos.com","password":"owner123"}'
```

### Register New User
```bash
# First, login and copy the token from the response
TOKEN="your_jwt_token_here"

curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "email":"test@pos.com",
    "password":"test123",
    "full_name":"Test User",
    "role":"cashier"
  }'
```

## Project Structure

```
backend/
├── config/
│   ├── database.js      # MySQL connection pool
│   └── auth.js          # JWT configuration
├── controllers/
│   └── authController.js  # Login, register logic
├── middleware/
│   ├── authenticate.js    # JWT verification
│   └── authorize.js       # Role-based access control
├── models/
│   └── User.js           # User database queries
├── routes/
│   └── auth.js           # Auth endpoints
├── server.js             # Express app entry point
├── package.json
├── .env                  # Environment variables
└── .env.example          # Environment template
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| DB_HOST | MySQL host | localhost |
| DB_USER | MySQL user | root |
| DB_PASSWORD | MySQL password | (empty) |
| DB_NAME | Database name | pos_myanmar |
| DB_PORT | MySQL port | 3306 |
| JWT_SECRET | Secret for JWT signing | (must change in production) |
| JWT_EXPIRATION | Token expiration time | 24h |
| PORT | Server port | 5000 |
| NODE_ENV | Environment | development |
| FRONTEND_URL | Frontend URL for CORS | http://localhost:3000 |

## Development

Run in development mode with auto-reload:
```bash
npm run dev
```

The server will automatically restart when you make changes to files.

## Security Notes

- Passwords are hashed with bcrypt (work factor: 10)
- JWT tokens expire after 24 hours
- Owner role required to create new users
- All endpoints (except /auth/login) require authentication
- CORS configured to allow frontend origin only

## Next Steps

1. ✅ Backend authentication complete
2. 🔄 Implement Product Management API (EPIC-2)
3. 🔄 Implement Sales Recording API (EPIC-3)
4. 🔄 Build React frontend (EPIC-1 frontend stories)
