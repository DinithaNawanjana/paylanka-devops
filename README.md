# 🏦 PayLanka DevOps Project  
### A Cloud-Native Payment Microservice System with Full CI/CD Pipeline

---

## 📘 Overview

**PayLanka** is a simulated **FinTech microservices project** designed to demonstrate real-world **DevOps workflows**, including **containerization**, **CI/CD**, and **cloud deployment**.

The system provides a simple but functional **Payment Management Portal**, allowing users to:
- Add new payment transactions.
- View recent payments and last 7-day trends.
- Automatically compute key metrics (total, count, LKR sum).
- View system health through a RESTful API endpoint.

This project was built as part of the **Virtualization & Cloud Computing Technologies (IE4030)** assignment at **SLIIT**, following professional industry processes and tools.

---

## 🧩 Architecture

```
┌──────────────────────────────┐
│        PayLanka Web          │
│  (Nginx + Tailwind + JS)     │
│     Port: 8080               │
│  - Displays dashboard         │
│  - Proxies /api → API        │
└─────────────┬────────────────┘
              │
              ▼
┌──────────────────────────────┐
│        PayLanka API          │
│ (Node.js + Express + PostgreSQL) │
│     Port: 8000               │
│  - REST endpoints:           │
│     • /api/payments          │
│     • /api/summary           │
│     • /health                │
└─────────────┬────────────────┘
              │
              ▼
┌──────────────────────────────┐
│        PostgreSQL DB         │
│  Stores payment records      │
│  Persisted via Docker volume │
└──────────────────────────────┘
```

---

## ⚙️ Technology Stack

| Component | Technology | Description |
|------------|-------------|-------------|
| **Backend (API)** | Node.js 20 + Express | REST API for payments |
| **Database** | PostgreSQL 16 | Persistent data storage |
| **Frontend (Web)** | Nginx + Tailwind CSS + Chart.js | Modern dashboard with real-time data |
| **Containerization** | Docker, Docker Compose | Multi-service orchestration |
| **CI/CD Pipeline** | GitHub Actions | Automated linting, testing, building, and pushing to Docker Hub |
| **Cloud Deployment** | AWS EC2 | Production-ready environment |
| **Testing** | Jest | Unit testing (centsToLkr utility) |
| **Linting** | ESLint | Code quality assurance |

---

## 🧠 Development Workflow

### Phase 1 — Plan & Design
- Defined architecture & flow using **Lucidchart** and **Jira boards**.
- Created `docker-compose.yml` for local dev and `docker-compose.prod.yml` for deployment.
- Planned a clean microservice separation between `API`, `DB`, and `WEB`.

### Phase 2 — Develop & Test Locally
- Implemented Node.js API (`services/payments-api`).
- Created responsive dashboard frontend under `web/portal`.
- Configured `eslint` and `jest` for static analysis and testing.
- Verified endpoints via `http://localhost:8000/health`.

### Phase 3 — Containerization
- Built Docker images for each service:
  - `dinithan/paylanka-api`
  - `dinithan/paylanka-web`
- Verified via:
  ```bash
  docker compose -f docker-compose.prod.yml up -d
  docker ps
  ```
- Confirmed API and web communication through proxy.

### Phase 4 — Continuous Integration (CI)
Automated testing, linting, and builds using **GitHub Actions**.

#### `.github/workflows/ci-cd.yml`
- Runs on every push to `main`.
- Lints and tests API service.
- Builds Docker images for API and WEB.
- Tags images as:
  - `latest`
  - `prod`
  - `YYYY.MM.DD-HHMMSS`
- Pushes to Docker Hub automatically.

### Phase 5 — Continuous Deployment (CD)
(Optional but industry-standard)
- Deployed stack on **AWS EC2** using `docker-compose.prod.yml`.
- Pipeline can SSH into EC2, pull new images, and redeploy automatically.

---

## 🚀 Run Locally

### Prerequisites
- Docker Desktop installed
- Node.js (for local testing)
- Internet connection (for Docker Hub pulls)

### Steps
```bash
# 1. Clone repo
git clone https://github.com/DinithaNawanjana/paylanka-devops.git
cd paylanka-devops

# 2. Launch system
docker compose -f docker-compose.prod.yml up -d

# 3. Open
http://localhost:8080
```

To stop:
```bash
docker compose down
```

---

## ✅ Health Checks

| Service | URL | Description |
|----------|-----|-------------|
| API | `http://localhost:8000/health` | Returns `{ ok: true }` if running |
| Web | `http://localhost:8080/health` | Proxied API health |
| Database | Internal check via `pg_isready` |

---

## 🧪 Example API Endpoints

### Get all payments
```bash
GET /api/payments
```

### Add a payment
```bash
POST /api/payments
{
  "reference": "INV-2025-1001",
  "amount_cents": 250000,
  "currency": "LKR"
}
```

### Summary
```bash
GET /api/summary
# → { "count": 3, "sum_cents": 434000, "last7": [...] }
```

---

## 📦 Docker Images (on Docker Hub)
| Service | Repository | Example Tags |
|----------|-------------|---------------|
| API | [`dinithan/paylanka-api`](https://hub.docker.com/r/dinithan/paylanka-api) | `latest`, `prod`, `2025.10.26-141500` |
| WEB | [`dinithan/paylanka-web`](https://hub.docker.com/r/dinithan/paylanka-web) | `latest`, `prod`, `2025.10.26-141500` |

---

## ☁️ Cloud Deployment (AWS EC2)

```bash
sudo apt update && sudo apt install docker.io docker-compose-plugin -y
sudo mkdir -p /opt/paylanka
cd /opt/paylanka
sudo curl -O https://raw.githubusercontent.com/DinithaNawanjana/paylanka-devops/main/docker-compose.prod.yml
sudo docker compose -f docker-compose.prod.yml up -d
```

Access at:  
**`http://<EC2_PUBLIC_IP>`**

---

## 🔁 CI/CD Pipeline Flow

```
Developer Push → GitHub Actions → Lint & Test → Build Docker Images → Push to Docker Hub → (Optional) Deploy to EC2
```

---

## 📸 Screenshots (add before submission)
| Section | Screenshot |
|----------|-------------|
| System Architecture | (diagram.png) |
| Running Containers | (docker_ps.png) |
| Portal Dashboard | (portal_view.png) |
| GitHub Action Run | (cicd_success.png) |
| AWS Deployment | (ec2_deploy.png) |

---

## 🧾 Future Improvements
- Add payment authentication (JWT)
- Implement service discovery via Docker network alias
- Automate multi-environment deploys (dev/staging/prod)
- Integrate monitoring via Prometheus & Grafana

---

## 👨‍💻 Author
**👤 Dinitha Nawanjana**  
BSc (Hons) in Computer Systems & Network Engineering – SLIIT  
📧 dinithanawanjana@example.com  
🔗 [LinkedIn](https://linkedin.com/in/DinithaNawanjana)

---

> 💡 *This project demonstrates an end-to-end DevOps lifecycle using industry-standard technologies: from code → container → cloud.*
