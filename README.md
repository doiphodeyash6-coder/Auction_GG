# Gavel & Grain — Online Auction System

A full-stack auction app built to demonstrate the ten lab experiments in one working project. It includes a responsive React + Tailwind interface, bidder accounts, curator tools, validated REST APIs, MongoDB persistence and live Socket.IO bidding.

## Run it locally

### Option A: Docker Compose

1. Copy `.env.example` to `.env` and replace the example JWT secret and curator password.
2. Run `docker compose up --build` from this folder.
3. Open [http://localhost:4000](http://localhost:4000).

Compose starts MongoDB and the app. The first startup creates four sample auctions and, when `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set, a curator account. Bidder accounts can be registered from the site. Keep `.env` private.

### Option B: Local Node.js and MongoDB

1. Install Node.js 20+.
2. Copy `.env.example` to `.env`; set `JWT_SECRET` and the optional curator credentials. Leave `MONGODB_URI` empty for the local in-memory MongoDB, or set it to a MongoDB connection string to keep data between runs.
3. Run `npm install`, then `npm run dev`.
4. Open [http://localhost:5173](http://localhost:5173). Vite serves the UI and proxies `/api` and `/socket.io` to the API on port 4000.

The first local startup downloads a MongoDB binary for the development-only in-memory database. Its auction and account data resets when the API process stops. Use Docker Compose for persistent local MongoDB storage.

For a production-style single-process run, use `npm run build` followed by `npm start`. The Express server serves the built UI and API from port 4000.

## Try the live bidding experiment

1. Open the app in two separate browser profiles or windows.
2. Register two bidder accounts and sign each window in with a different account.
3. Open the same active lot in both windows. The auction panel shows the Socket.IO connection and room watcher count.
4. Place a valid bid from one window. The other window's current price, bidder and bid history update without a page refresh.
5. Submit an amount below the next minimum increment to see server-side rejection. Open the same lot as an admin to close it early.

Guests may watch live auction updates. Only a signed-in bidder can bid. Only a curator/admin can publish or close a lot.

## Experiments demonstrated

| # | Experiment | Where it appears |
|---|---|---|
| 1 | Responsive, interactive Tailwind UI | Auction grid, category filters, search, dialogs and mobile layouts |
| 2 | React Hooks | `useEffect`, `useContext`, `useReducer`, plus `useCountdown` and `useAuctionSocket` custom hooks |
| 3 | Complex shared state | Auth and auction Context providers with reducer-based updates |
| 4 | REST API + MongoDB/Mongoose | Express routes and `User`/`Auction` models |
| 5 | Secure REST APIs | Field validation, Helmet, CORS allowlist, JSON size limit and rate limits |
| 6 | JWT authentication and roles | Hashed passwords, bearer tokens, bidder/admin middleware and curator routes |
| 7 | Postman API validation | Import `postman/Gavel-Grain.postman_collection.json` |
| 8 | Real-time communication | Socket.IO auction rooms broadcast accepted bids and presence |
| 9 | CI/CD | `.github/workflows/ci.yml` builds on GitHub Actions and deploys to Render when `RENDER_DEPLOY_HOOK` is configured |
| 10 | DevOps and Docker | `Dockerfile` and `docker-compose.yml` run the application with MongoDB |

## API outline

All API responses are JSON. Protected routes use `Authorization: Bearer <JWT>`.

| Method | Route | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/health` | Public | API and MongoDB health |
| `POST` | `/api/auth/register` | Public | Create a bidder account |
| `POST` | `/api/auth/login` | Public | Sign in and receive a JWT |
| `GET` | `/api/auth/me` | Signed in | Read the current profile |
| `GET` | `/api/auctions` | Public | List and filter auctions |
| `GET` | `/api/auctions/:id` | Public | Read an auction and its bid history |
| `POST` | `/api/auctions` | Admin | Publish a lot |
| `POST` | `/api/auctions/:id/bids` | Bidder or admin | Place a bid through REST |
| `POST` | `/api/auctions/:id/close` | Admin | End an active auction |

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

Import `postman/Gavel-Grain.postman_collection.json`. Set `baseUrl` to the server origin. Run **Register bidder** first; the collection saves the returned bidder JWT. Set the `adminEmail` and `adminPassword` variables in a Postman environment to the curator credentials from `.env`, then run **Login curator (admin)**. The collection includes positive requests plus unauthenticated and wrong-role checks.

## Deploy

### Render

The `render.yaml` blueprint describes a Node web service. In Render, create a managed MongoDB database or use MongoDB Atlas, then provide `MONGODB_URI`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` when prompted. The blueprint generates `JWT_SECRET` and deploys the combined UI/API service. To enable the GitHub Actions deploy step, create a Render deploy hook and save it as the GitHub Actions secret `RENDER_DEPLOY_HOOK`.

### Vercel frontend + Render API

Vercel can host the Vite frontend separately using `vercel.json`. Set `VITE_API_URL` and `VITE_SOCKET_URL` to the Render API origin in Vercel’s project environment. Add the Vercel site origin to `CLIENT_URL` on the API, comma-separated if more than one frontend origin is used. The same Render API still connects to MongoDB and hosts Socket.IO.

## Environment variables

See `.env.example`. In production, use a long random `JWT_SECRET`, a TLS-protected MongoDB URI and explicit `CLIENT_URL` values. Do not commit `.env` or real credentials.

## Project structure

```text
src/                 React app, contexts, hooks and styles
server/              Express API, Socket.IO, Mongoose models and seed data
public/assets/       Local object artwork used by the demo lots
postman/             Importable API collection
.github/workflows/   CI build and optional Render deploy step
Dockerfile           Production image
docker-compose.yml   App + MongoDB local stack
```

This is an educational auction system: it implements bidding, accounts and role checks, but does not collect payments or provide shipping workflows.
