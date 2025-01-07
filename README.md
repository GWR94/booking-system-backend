# Booking System Backend

This is the backend for a booking system that allows users to book slots in various bays. The backend is built with Node.js, Express, and Prisma ORM, and it uses PostgreSQL as the database.

## Table of Contents

- [Booking System Backend](#booking-system-backend)
  - [Table of Contents](#table-of-contents)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running the Application](#running-the-application)
    - [Start the application in development mode](#start-the-application-in-development-mode)
  - [API](#api)
    - [User Routes](#user-routes)
    - [Slot Routes](#slot-routes)
    - [Booking Routes](#booking-routes)
    - [Scripts](#scripts)
  - [Security Features](#security-features)
  - [Database](#database)
    - [Development Setup](#development-setup)
    - [Model](#model)
  - [Tech Stack](#tech-stack)
  - [TODOS](#todos)

## Installation

1. Clone the repository:
    ```sh
    git clone https://github.com/yourusername/booking-system-backend.git
    cd booking-system-backend
    ```

2. Install the dependencies:
    ```sh
    npm install
    ```

## Environment Variables

The environment variables below need to added for the project to function correctly.

```env
DATABASE_URL
SESSION_SECRET
ACCESS_TOKEN_SECRET
REFRESH_TOKEN_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
FACEBOOK_APP_ID
FACEBOOK_APP_SECRET
STRIPE_SECRET_KEY
FRONT_END
NODE_ENV
PORT
```

## Running the Application

### Start the application in development mode

Start the development server with `npm run dev`. The server will run at `http://localhost:4000`.


## API

### User Routes
- POST /api/user/register - Register a new user
- POST /api/user/login - Login an existing user
- POST /api/user/logout - Logout an existing user
- GET /api/user/verify - Verify user
- POST /api/user/refresh - Refresh access token
- GET /api/user/profile - Get user profile (protected)
- DELETE /api/user/profile/delete - Delete user profile (protected)

### Slot Routes
- POST /api/slots - Create a new slot (admin only)
- GET /api/slots - Retrieve all available slots
- GET /api/slots/:id - Retrieve a unique slot by ID
- PUT /api/slots/:id - Update an existing slot (admin only)
- DELETE /api/slots/:id - Delete a slot (admin only)

### Booking Routes
- POST /api/bookings - Create a new booking (authenticated users)
- POST /api/bookings/create-checkout-session - Create a checkout session for payment
- DELETE /api/bookings/:bookingId - Cancel an existing booking (authenticated users)

### Scripts
- npm run dev - Start the application in development mode
- npm run seed - Seed the database with initial data
- npm run populate - Populate the database with slots

## Security Features
- JWT authentication
- HTTP-only cookies
- Rate limiting
- CORS protection
- Helmet security headers
- Input validation
- Role-based access control
- Database Schema

## Database

### Development Setup
1. Initialize the database with Prisma:
```npx prisma migrate dev --name init```

2. Generate the Prisma client:
```npx prisma generate```

### Model
The application uses Prisma with PostgreSQL and includes the following models:

User
Bay
Slot
Booking

## Tech Stack

- TypeScript
- Node.js
- Express.js
- Prisma ORM
- PostgreSQL
- JWT
- Passport.js
- Stripe
- bcrypt
- dayjs

## TODOS

- Test suite
