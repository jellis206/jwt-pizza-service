# 🍕 jwt-pizza-service

![Coverage badge](https://pizza-factory.cs329.click/api/badge/accountId/jwtpizzaservicecoverage)

Backend service for making JWT pizzas. This service tracks users and franchises and orders pizzas. All order requests are passed to the JWT Pizza Factory where the pizzas are made.

JWTs are used for authentication objects.

## Deployment

In order for the server to work correctly it must be configured by providing a `.env` file with your secrets. Copy the `.env.example` file to `.env` and fill in your values:

```bash
cp .env.example .env
```

Then edit `.env` with your actual values:

```bash
# JWT Secret - Any random string for signing JWTs
JWT_SECRET=yourjwtsecrethere

# Database Configuration
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=yourpasswordhere
DB_DATABASE=pizza
DB_CONNECT_TIMEOUT=60000

# Database Pagination
DB_LIST_PER_PAGE=10

# Pizza Factory Configuration
FACTORY_URL=https://pizza-factory.cs329.click
FACTORY_API_KEY=yourapikeyhere
```

The `.env` file is already in `.gitignore` so your secrets won't be committed to git.

## Endpoints

You can get the documentation for all endpoints by making the following request.

```sh
curl localhost:3000/api/docs
```

## Development notes

Install the required packages.

```sh
npm install express jsonwebtoken mysql2 bcrypt
```

Nodemon is assumed to be installed globally so that you can have hot reloading when debugging.

```sh
npm -g install nodemon
```
