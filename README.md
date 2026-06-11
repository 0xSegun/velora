# 🔮 Velora — AI-Powered Inflation & Deflation Prediction Platform

<div align="center">

![Velora](https://img.shields.io/badge/Velora-AI%20Predictions-8B5CF6?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIgMkw0IDdWMTdMMTIgMjJMMjAgMTdWN0wxMiAyWiIgZmlsbD0iIzhCNUNGNiIvPjwvc3ZnPg==)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104-009688?style=for-the-badge&logo=fastapi)
![PyTorch](https://img.shields.io/badge/PyTorch-2.0-EE4C2C?style=for-the-badge&logo=pytorch)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql)

**An enterprise-grade AI platform that predicts inflation & deflation trends using Time-Series Transformer models with multi-head attention mechanisms.**

*Built for the Nigerian economy with support for global economic analysis.*

[Live Demo](https://velora.vercel.app) · [Documentation](#documentation) · [API Reference](#api-reference)

</div>

---

## ✨ Features

### 🧠 AI/ML Prediction Engine
- **TS-Transformer Model** with multi-head self-attention mechanism
- Trained on CBN (Central Bank of Nigeria), NBS (National Bureau of Statistics), and FRED data
- Predicts inflation rate, deflation probability, trend direction, and risk levels
- 6-month forecast horizon with confidence intervals
- Real-time prediction API

### 📊 Analytics Dashboard
- Real-time inflation prediction graphs with animated visualizations
- Deflation risk indicators and economic health meters
- AI confidence scoring and forecast accuracy tracking
- Country comparison analytics (Nigeria, USA, UK, Ghana, South Africa)
- Historical trend analysis (CPI, GDP, exchange rates)
- Interactive heatmaps and prediction timelines
- AI-generated economic insights panel

### 🔐 Security & Authentication
- JWT authentication (access + refresh tokens)
- Google OAuth integration
- Email/password authentication with email verification (via Resend)
- Role-based access control (User, Analyst, Admin)
- Rate limiting and CSRF protection

### 🏗️ Admin Dashboard
- Full platform administration
- User management with role assignment
- AI model management and training controls
- CMS for dynamic content editing
- API credentials management (FRED, Resend, etc.)
- System health monitoring
- SEO and branding customization

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14, TypeScript, TailwindCSS, Framer Motion, Recharts, Zustand |
| **Backend** | Python, FastAPI, SQLAlchemy, Pydantic v2 |
| **Database** | PostgreSQL 16 |
| **AI/ML** | PyTorch, TS-Transformer, Scikit-learn, Pandas, NumPy |
| **Auth** | NextAuth.js, JWT, Google OAuth, Resend |
| **DevOps** | Docker, Docker Compose, Vercel |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- PostgreSQL 16+
- Docker & Docker Compose (optional)

### Quick Start with Docker

```bash
# Clone the repository
git clone https://github.com/yourusername/infinicast.git
cd infinicast

# Copy environment variables
cp .env.example .env
# Edit .env with your credentials

# Start all services
docker-compose up -d

# The app will be available at:
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### Manual Setup

#### Backend
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# OR
.\venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env

# Run database migrations
# (Ensure PostgreSQL is running)
python -m app.database

# Seed sample data
python data/seed.py

# Start the server
uvicorn app.main:app --reload --port 8000
```

#### Frontend
```bash
cd frontend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

---

## 📁 Project Structure

```
infinicast/
├── frontend/                 # Next.js 14 App
│   ├── src/
│   │   ├── app/             # App Router pages
│   │   ├── components/      # React components
│   │   ├── lib/             # Utilities & API client
│   │   ├── store/           # Zustand state stores
│   │   ├── hooks/           # Custom React hooks
│   │   └── types/           # TypeScript types
│   └── public/              # Static assets
├── backend/                  # FastAPI Backend
│   ├── app/
│   │   ├── models/          # SQLAlchemy models
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── routers/         # API routes
│   │   ├── services/        # Business logic
│   │   ├── middleware/      # Auth, CORS, rate limiting
│   │   └── utils/           # Security, email utilities
│   ├── ai/                  # AI/ML Engine
│   │   ├── model/           # TS-Transformer architecture
│   │   ├── pipeline/        # Data preprocessing
│   │   ├── training/        # Training loop & evaluation
│   │   └── inference/       # Prediction engine
│   └── data/                # Sample datasets & seeders
├── docker-compose.yml
└── README.md
```

---

## 🔌 API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login with email/password |
| POST | `/api/auth/google` | Google OAuth login |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/forgot-password` | Request password reset |
| GET | `/api/auth/me` | Get current user |

### Predictions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/predictions/forecast` | Run inflation prediction |
| GET | `/api/predictions/history` | Get prediction history |
| GET | `/api/predictions/countries/{code}` | Get by country |
| POST | `/api/predictions/compare` | Compare countries |

### Economic Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/economic-data/latest` | Latest indicators |
| GET | `/api/economic-data/nigeria` | Nigeria-specific data |
| GET | `/api/economic-data/historical` | Historical data |

Full API documentation available at `/docs` when running the backend.

---

## 🎓 University Project

This project was developed as a final year project demonstrating:
- Applied Machine Learning (Time-Series Transformer with Attention)
- Full-Stack Web Development
- RESTful API Design
- Database Design & Management
- DevOps & Deployment
- UI/UX Design Principles

### Data Sources
- **CBN** — Central Bank of Nigeria (monetary policy rates, exchange rates)
- **NBS** — National Bureau of Statistics (CPI, inflation rates, GDP)
- **FRED** — Federal Reserve Economic Data (US & global economic indicators)

---

## 📜 License

This project is developed for academic purposes. All rights reserved.

---

<div align="center">
  <b>Built with ❤️ for economic intelligence</b>
</div>
