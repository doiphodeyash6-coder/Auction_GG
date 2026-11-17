# Gavel & Grain — Online Auction System

A full-stack auction app built to demonstrate the ten lab experiments in one working project. It includes a responsive React + Tailwind interface, buyer and seller accounts, curator tools, validated REST APIs, MongoDB persistence, live Socket.IO bidding and auction email notifications.

## Run it locally

### Option A: Docker Compose

1. Install Docker Desktop and start it.
2. Copy `.env.example` to `.env` and replace `JWT_SECRET` with a random value of at least 32 characters. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` if you want a curator account.
3. Run `docker compose up --build -d` from this folder.
4. Check service health with `docker compose ps`, then open [http://localhost:4000](http://localhost:4000).

Compose builds the production image, starts the app and MongoDB, waits for MongoDB's health check, and keeps database files in the `auction-data` named volume. The image runs as a non-root user and has an HTTP health check. The first startup creates four sample auctions and, when `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set, a curator account. Buyer and seller accounts can be registered from the site. Keep `.env` private.

Use `docker compose logs -f app` to follow the application logs. Stop the services with `docker compose down`; the database volume remains. `docker compose down -v` also deletes auction data.

### Option B: Local Node.js and MongoDB

1. Install Node.js 20+.
2. Copy `.env.example` to `.env`; set `JWT_SECRET` and the optional curator credentials. Leave `MONGODB_URI` empty for the local development MongoDB stored under `.tmp`, or set it to a MongoDB connection string.
3. Run `npm install`, then `npm run dev`.
4. Open [http://localhost:5173](http://localhost:5173). Vite serves the UI and proxies `/api` and `/socket.io` to the API on port 4000.

The first local startup downloads a MongoDB binary for development. Local auction and account data stays under `.tmp/mongo-data` between API restarts. Delete that folder only if you want to reset your local data. Sign-in tokens last 30 days by default.

For a production-style single-process run, use `npm run build` followed by `npm start`. The Express server serves the built UI and API from port 4000.

## Try the live bidding experiment

1. Open the app in two separate browser profiles or windows.
2. Register a seller account and publish a lot, then register two buyer accounts and sign each window in with a different buyer.
3. Open the same active lot in both windows. The auction panel shows the Socket.IO connection and room watcher count.
4. Place a valid bid from one window. The other window's current price, bidder and bid history update without a page refresh.
5. Submit an amount below the next minimum increment to see server-side rejection. Sign in as the seller to close that seller's lot early.

Guests may watch live auction updates. Buyers can bid; sellers can publish and close their own lots; a curator/admin can manage any lot. Sellers cannot bid, and users cannot bid on their own lot.

## Auction email notifications

The API sends transactional emails through [Resend](https://resend.com) after a seller publishes a lot, a buyer places a bid, a buyer is outbid, or an auction ends. Accepted bids notify the buyer and seller; an outbid buyer also receives an alert. Closing an auction notifies the seller and the winning buyer, when there is one. Email errors are logged and do not undo a saved bid or auction action.

To enable delivery locally, create a Resend API key and set `RESEND_API_KEY` and `EMAIL_FROM` in `.env`, then restart the API server. For production, set the same values in the API host's environment settings (for example, Render); `EMAIL_FROM` must be a sender address on a domain verified with Resend. Keep the API key on the server, never in Vercel's frontend environment variables. Without these settings the auction app still works, but email notifications are skipped.

After signing in, use **Send a test email** in the Auction email updates card. It sends only to the signed-in account, so you can check delivery before demonstrating a listing or bid. A missing configuration or provider failure is shown in the app. For real auction activity, the seller receives a listing notice, both the buyer and seller receive accepted-bid notices, the previous high bidder receives an outbid notice, and the seller and winner receive the closing result.

## Experiments demonstrated

| # | Experiment | Where it appears |
|---|---|---|
| 1 | Responsive, interactive Tailwind UI | Auction grid, category filters, search, dialogs and mobile layouts |
| 2 | React Hooks | `useEffect`, `useContext`, `useReducer`, plus `useCountdown` and `useAuctionSocket` custom hooks |
| 3 | Complex shared state | Auth and auction Context providers with reducer-based updates |
| 4 | REST API + MongoDB/Mongoose | Express routes and `User`/`Auction` models |
| 5 | Secure REST APIs | Field validation, Helmet, CORS allowlist, JSON size limit and rate limits |
| 6 | JWT authentication and roles | Hashed passwords, bearer tokens, buyer/seller/admin middleware and seller listing routes |
| 7 | Postman API validation | Import `postman/Gavel-Grain.postman_collection.json` |
| 8 | Real-time communication | Socket.IO auction rooms broadcast accepted bids and presence |
| 9 | CI/CD | `.github/workflows/ci.yml` builds on GitHub Actions and deploys to Render when `RENDER_DEPLOY_HOOK` is configured |
| 10 | DevOps and Docker | Multi-stage non-root `Dockerfile`, Compose health checks and persistent MongoDB volume; Render deploys the Docker image |

## API outline

All API responses are JSON. Protected routes use `Authorization: Bearer <JWT>`.

| Method | Route | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/health` | Public | API and MongoDB health |
| `POST` | `/api/auth/register` | Public | Create a buyer or seller account (`role: "buyer"` or `role: "seller"`; defaults to buyer) |
| `POST` | `/api/auth/login` | Public | Sign in and receive a JWT |
| `GET` | `/api/auth/me` | Signed in | Read the current profile |
| `POST` | `/api/auth/email-test` | Signed in | Send a delivery check to the signed-in account |
| `GET` | `/api/auctions` | Public | List and filter auctions |
| `GET` | `/api/auctions/:id` | Public | Read an auction and its bid history |
| `POST` | `/api/auctions` | Seller or admin | Publish a lot |
| `POST` | `/api/auctions/:id/bids` | Buyer or admin | Place a bid through REST |
| `POST` | `/api/auctions/:id/close` | Owning seller or admin | End an active auction |

### Socket.IO events

Connect to the same origin as the API, optionally passing `{ auth: { token } }` for a signed-in user.

| Direction | Event | Payload / result |
|---|---|---|
| Client → server | `auction:join` | Auction id |
| Server → client | `auction:snapshot` | Current auction state after joining |
| Server → room | `auction:update` | Updated auction after an accepted bid or close |
| Server → room | `auction:presence` | `{ auctionId, count }` watcher count |
| Client → server | `auction:bid` | `{ auctionId, amount }`, with an acknowledgement containing `{ ok, auction }` or `{ ok: false, error }` |

The bid update uses an atomic MongoDB compare-and-update on the current price, so two simultaneous bids cannot both overwrite the same previous high bid. REST bids use the same service and are broadcast to the same socket room.

## Postman

Import `postman/Gavel-Grain.postman_collection.json`. Set `baseUrl` to the server origin. Register a buyer with `role: "buyer"` and a seller with `role: "seller"`; set the admin credentials in a Postman environment to the curator values from `.env`. Use buyer JWTs for bids and seller/admin JWTs for publishing and closing auctions. The collection includes unauthenticated and wrong-role checks.

## Deploy

### Render

The `render.yaml` blueprint builds the full-stack service from the repository's `Dockerfile`. Configure `MONGODB_URI` with a MongoDB Atlas connection string, and provide `ADMIN_EMAIL` and `ADMIN_PASSWORD` when prompted. The blueprint generates `JWT_SECRET` and checks `/api/health` after deployment. Automatic Git deploys are disabled so the GitHub Actions workflow controls deployment.

### GitHub Actions + Docker + Render

On each pull request and push to `main`, `.github/workflows/ci.yml` installs from the lockfile, builds the React app, and builds the production Docker image. To deploy from a successful push to `main`, create a Render deploy hook and add it to the GitHub repository as the Actions secret `RENDER_DEPLOY_HOOK`. Render then builds and runs the Dockerfile image. Add production secrets such as `MONGODB_URI`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `RESEND_API_KEY` and `EMAIL_FROM` in Render's environment settings; never commit them to GitHub.

To deploy manually from a local Docker build, run `docker build -t gavel-grain:local .` and `docker compose up --build -d`. The compose setup is for local demonstration; production uses Render and MongoDB Atlas rather than the local MongoDB container.

### Vercel frontend + Render API

Vercel can host the Vite frontend separately using `vercel.json`. The non-secret `.env.production` file points the frontend to `https://gavel-grain.onrender.com` for API and Socket.IO requests. Vercel project environment variables `VITE_API_URL` and `VITE_SOCKET_URL` can override these public origins. The Render API must be deployed and connected to MongoDB. The allowed production origins include `https://auction-gg.vercel.app` and the Render service origin, so the browser can call the API and join auction rooms.

## Environment variables

See `.env.example`. In production, use a long random `JWT_SECRET`, a TLS-protected MongoDB URI, explicit `CLIENT_URL` values, and the Resend variables if emails are required. Do not commit `.env` or real credentials.

## Project structure

```text
src/                 React app, contexts, hooks and styles
server/              Express API, Socket.IO, Mongoose models and seed data
public/assets/       Local object artwork used by the demo lots
postman/             Importable API collection
.github/workflows/   CI build and optional Render deploy step
Dockerfile           Production image
docker-compose.yml   App + MongoDB local stack
.dockerignore        Excludes secrets, local data and build output from images
```

This is an educational auction system: it implements bidding, accounts and role checks, but does not collect payments or provide shipping workflows.
