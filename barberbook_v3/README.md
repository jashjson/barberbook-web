# BarberBook v2 — Production Web App

**React 18 + Vite · Supabase · Role-based auth · Real-time queue**

---

## Architecture

```
barberbook/
├── src/
│   ├── context/
│   │   ├── AuthContext.jsx      ← Session, profile, sign-in/out
│   │   └── ToastContext.jsx     ← App-wide notifications
│   ├── lib/
│   │   └── supabase.js          ← DB client + all query helpers
│   ├── hooks/
│   │   └── useQueue.js          ← Real-time queue subscriptions
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Icon.jsx         ← Inline SVG icon system
│   │   │   └── Primitives.jsx   ← Modal, Toggle, Spinner, etc.
│   │   └── layout/
│   │       ├── AppLayout.jsx    ← Sidebar, header, mobile nav
│   │       └── ProtectedRoute.jsx
│   ├── pages/
│   │   ├── auth/AuthPages.jsx   ← Login + Register with role picker
│   │   ├── customer/            ← Home, Book (3-step), History, Profile
│   │   ├── barber/              ← Queue, Schedule, Earnings, Profile
│   │   └── owner/               ← Dashboard, Bookings, Staff, Shop Setup
│   ├── styles/app.css           ← Full design system (CSS variables)
│   └── App.jsx                  ← Role-based router
├── schema.sql                   ← Run in Supabase SQL editor
├── nginx.conf                   ← VPS deployment config
└── .env.example
```

---

## How Roles Work

Each user has exactly **one role** (customer / barber / owner), set at registration. **You cannot switch roles** — you must create separate accounts. This ensures real-world security: a barber cannot see another shop's data.

| Role | What they see | Key features |
|---|---|---|
| Customer | Their active token + live queue + book page | Book slots, cancel, history |
| Barber | Their personal queue for today | Mark done, skip, schedule, earnings |
| Owner | Full shop dashboard | All bookings, staff mgmt, shop setup |

---

## Supabase Setup

### 1. Create project
Go to [supabase.com](https://supabase.com), create a new project.

### 2. Enable Phone Auth
Supabase Dashboard → Authentication → Providers → Phone → Enable.
Set your SMS provider (Twilio, Vonage, etc.) for production.
For dev, enable "Confirm email" and use email+phone or just password auth.

### 3. Run schema
Copy the entire contents of `schema.sql` into the Supabase SQL Editor and run it. This creates:
- All tables with proper foreign keys
- Row Level Security policies (users only see their own data)
- Auto-token trigger (assigns sequential tokens per barber per day)
- Real-time enabled on `bookings` and `barbers` tables

### 4. Get credentials
Supabase Dashboard → Settings → API → copy `Project URL` and `anon/public` key.

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Set environment variables
cp .env.example .env
# Edit .env with your Supabase URL and anon key

# 3. Run dev server
npm run dev
# → http://localhost:3000
```

---

## VPS Deployment

### Build
```bash
npm install
npm run build
# Output: /dist
```

### Deploy to VPS (Ubuntu/Debian)
```bash
# Install Nginx
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx

# Copy dist to server
rsync -avz dist/ user@your-vps:/var/www/barberbook/dist/

# Set up Nginx
sudo cp nginx.conf /etc/nginx/sites-available/barberbook
sudo ln -s /etc/nginx/sites-available/barberbook /etc/nginx/sites-enabled/
# Edit nginx.conf: replace "your-domain.com" with your actual domain

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Test and reload
sudo nginx -t && sudo systemctl reload nginx
```

### CI/CD (optional, GitHub Actions)
```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
      - uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_KEY }}
          source: dist/
          target: /var/www/barberbook/
```

---

## Real-time Queue Logic

The queue works via **Supabase Realtime** (PostgreSQL logical replication → WebSockets):

1. Customer books → `INSERT` into `bookings` table
2. DB trigger fires → assigns `token_no` (sequential per barber per day)
3. Supabase pushes the change to all subscribed clients via WebSocket
4. `useBarberQueue` hook receives the event → refetches queue → UI updates
5. All phones in the same shop see the live state instantly

**Token assignment rule:** `MAX(token_no) + 1` for that barber on that calendar day (IST). Cancellations free the slot but do NOT reshuffle tokens — this is intentional to avoid confusion.

---

## Key Security Properties

- **No role switching in-app** — role is set once at registration, stored in DB
- **Row Level Security** — Supabase enforces at DB level: customers only see their own bookings, barbers only see bookings for their queue, owners only see their own shop
- **JWT auth** — every request is authenticated via Supabase JWT; anon key only allows what RLS permits
- **Phone-based auth** — no email needed; real Indian phone numbers for OTP (configure Twilio)
