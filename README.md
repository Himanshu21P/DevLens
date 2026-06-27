# DevLens 🔍

> **Developer Profile Analytics & AI Insights Engine**
> A premium developer portfolio auditing platform that compiles deterministic Git diagnostics and yields advanced qualitative AI recommendations.

---

## 🚀 Project Overview

**DevLens** is a production-grade developer intelligence platform. It ingests public/private GitHub metadata, evaluates portfolio metrics across six core dimensions using a custom mathematical scoring engine, and generates AI-driven career advisement, interactive learning roadmaps, resume readiness assessments, and interview preparations.

---

## ✨ Key Features

1. **Deterministic Analytics Engine:** Scores developers (0-100) across six categories:
   * **Repository Quality:** Evaluates original vs. fork ratios, size distribution, and issues hygiene.
   * **Documentation Quality:** Analyzes README completeness, licenses, and community guidelines.
   * **Technology Diversity:** Measures language diversity and ecosystem configurations.
   * **Project Activity:** Evaluates commit frequency and recency of push updates.
   * **Open Source Engagement:** Scales based on stars, forks, and followers.
   * **Portfolio Readiness:** Reviews biographic completeness, pinned repos, and live deployment links.
2. **Advanced AI Insights:** Utilizes Gemini AI with prompting, structural schemas, response caching, strict semantic validations, and resilient error retries/fallbacks.
3. **Historical Progress Dashboard:** Visualizes progression metrics, overall score deltas, regressions, and resolved portfolio action items over time using Recharts.
4. **Professional PDF Export:** Supports high-contrast, print-friendly multi-page PDF generation via `pdfkit` for career applications, along with Markdown and JSON exports.
5. **Secure Hybrid Authentication:** Supports Email/Password login, password resets, and GitHub OAuth account linking.

---

## 🏗️ Architecture Overview

DevLens isolates deterministic analytics from AI-generated qualitative summaries to enforce logical separation:

```mermaid
graph TD
    User([User Browser]) -->|HTTP Request| API[Analytics API Controller]
    API -->|Validate Input| Validator[Joi Validation Guard]
    API -->|Apply Rate Limiting| Limiter[Rate Limit Middleware]
    
    API -->|Query Profile & Repos| Service[Analytics Service]
    Service -->|Optional Token Resolving| DB[(Prisma & MySQL)]
    Service -->|Fetch Standard Metadata| Collector[Portfolio Data Collector]
    Collector -->|Fetch Standard Metadata| Adapter[Github Adapter]
    Adapter -->|Cache Read/Write| Redis[(Redis Cache)]
    Adapter -->|API Calls| Client[GitHub API Client]
    Client -->|HTTP Requests| GitHub[(GitHub API)]
    
    Collector -->|Normalize & Sanitize| Normalized[DeveloperAnalysisData Model]
    Normalized -->|Score Request| CentralCentral[Central Scoring Engine]
    
    CentralCentral -->|Invoke Category Services| Services[6 Core Scoring Services]
    Services -->|Read Weights/Limits| Config[scoringConfig.js]
    
    CentralCentral -->|Return Scores| Service
    
    Service -->|AI Insight Request| AIService[AI Service Orchestrator]
    AIService -->|Hash & Query Cache| AICache[(Redis Cache: ai:insights)]
    
    alt Cache Miss
        AIService -->|Invoke AI Provider| AIProvider[Gemini Provider]
        AIProvider -->|Request JSON| Gemini[(Gemini API)]
        Gemini -->|Return JSON| AIProvider
        AIProvider -->|Return Raw JSON| AIService
        AIService -->|Joi & Business Validation| AIService
        AIService -->|Write Cache| AICache
    end
    
    AIService -->|Return AI Insights & Metadata| Service
    Service -->|Status Envelope: completed| API
```

---

## 📂 Folder Structure

```
DevLens/
├── backend/
│   ├── prisma/             # Schema definitions and database migrations
│   ├── src/
│   │   ├── adapters/       # GithubAdapter class for data normalizations
│   │   ├── config/         # Database, Redis, and AI Configurations
│   │   ├── controllers/    # API controllers (thin handlers)
│   │   ├── middlewares/    # Authentication and rate limiting filters
│   │   ├── routes/         # Express routing definitions with Swagger docs
│   │   ├── services/       # Core service orchestrators (analytics, pdf, reports)
│   │   └── utils/          # Winston logging and crypto helper utilities
│   └── tests/              # Jest + Supertest integration suite
├── frontend/
│   ├── src/
│   │   ├── components/     # Reusable UI elements (guards, animated widgets)
│   │   ├── context/        # Authentication, toast, and theme state managers
│   │   ├── pages/          # Lazy-loaded page components (Dashboard, Login, Profile)
│   │   ├── services/       # Axios API wrapper definition
│   │   ├── test/           # Vitest integration tests (JSDOM environment)
│   │   └── utils/          # Client-side Markdown, JSON, and PDF export utility handlers
│   └── vite.config.js      # Vite compilation setup
└── docker-compose.yml      # Local MySQL and Redis containers
```

---

## 🛠️ Technology Stack

* **Backend:** Node.js, Express (ES Modules), Prisma ORM
* **Frontend:** React, Vite, Recharts, TailwindCSS
* **Databases:** MySQL 8.0, Redis (for API cache and insights caching)
* **Testing:** Jest & Supertest (Backend), Vitest & React Testing Library (Frontend)
* **Libraries:** `pdfkit` (PDF generation), `joi` (Validation schemas), `@google/generative-ai` (Gemini SDK)

---

## ⚙️ Environment Variables

Copy `backend/.env.example` to `backend/.env` and configure:

* `PORT`: Server port (default: 5000)
* `DATABASE_URL`: Prisma connection string (e.g. `mysql://user:pass@localhost:3306/devlens`)
* `REDIS_URL`: Redis connection URL (e.g. `redis://localhost:6379`)
* `JWT_SECRET` & `JWT_REFRESH_SECRET`: Cryptographic secrets for JSON Web Tokens
* `ENCRYPTION_KEY`: 32-byte hexadecimal key for client credential storage encryption
* `GITHUB_CLIENT_ID` & `GITHUB_CLIENT_SECRET`: GitHub developer OAuth credentials
* `GEMINI_API_KEY`: API key generated inside Google AI Studio

---

## 💻 Local Setup & Execution

### 1. Database and Cache Services
Launch MySQL and Redis services via Docker Compose:
```bash
docker-compose up -d
```

### 2. Backend Server
Navigate to the backend, install dependencies, run migrations, and start:
```bash
cd backend
npm install
npx prisma migrate dev
npm run dev
```

### 3. Frontend App
Navigate to the frontend, install dependencies, and launch Vite dev server:
```bash
cd frontend
npm install
npm run dev
```
Open your browser at `http://localhost:3000`.

---

## 🧪 Testing Instructions

### Backend (Jest)
Run backend integrations checking endpoint, session validations, and cache cycles:
```bash
cd backend
npm test
```

### Frontend (Vitest)
Run the React JSDOM test suite checking UI components, key listeners, and file downloads:
```bash
cd frontend
npx vitest run --pool=forks
```

---

## 📘 API Documentation

DevLens exposes clean swagger documentation at `/api-docs` on the backend.

### Success Response Format
```json
{
  "success": true,
  "data": {
    "targetGithubUsername": "octocat",
    "developerScore": 85
  }
}
```

### Error Response Format
```json
{
  "success": false,
  "error": {
    "message": "Resource not found",
    "code": "NOT_FOUND",
    "details": {}
  }
}
```

---

## 🗺️ Future Roadmap

* **Recruiter Perspectives:** Allow users to share public, read-only analytics URLs.
* **Progress Badges:** Embed dynamic SVG scoring badges directly inside GitHub README profiles.
* **Team Comparison Dashboard:** Allow developer teams to plot comparisons and identify engineering synergies.
