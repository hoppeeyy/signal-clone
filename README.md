# Signal Clone

A functional clone of the Signal messaging application, focusing on recreating the Signal user experience and core messaging workflows.

## Stack
- **Frontend:** Next.js (TypeScript) + Tailwind CSS
- **Backend:** Python FastAPI, SQLAlchemy 2.0, SQLite, Pydantic v2
- **Real-time:** WebSockets

## Structure
- `backend/`: FastAPI application
- `frontend/`: Next.js application

## Setup & Run (Backend)

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # On Windows (PowerShell)
   .\venv\Scripts\activate
   # On Mac/Linux
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the development server (this will automatically create the DB and seed data if empty):
   ```bash
   uvicorn app.main:app --reload --port 8001
   ```

5. The API will be available at `http://localhost:8001` with interactive docs at `http://localhost:8001/docs`.
