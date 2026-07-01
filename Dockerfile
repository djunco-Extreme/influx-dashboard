# Multi-stage build: frontend
FROM node:18-slim as frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend .
RUN npm run build

# Multi-stage: backend + built frontend
FROM python:3.11-slim
WORKDIR /app

# Install backend dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend
COPY backend ./backend

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist ./frontend-dist

# Env vars for production
ENV FRONTEND_DIST=/app/frontend-dist
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1

EXPOSE 3001

# Run Flask with gunicorn
CMD ["sh", "-c", "cd /app/backend && gunicorn -b 0.0.0.0:3001 --workers 4 --timeout 60 --access-logfile - app:app"]
