.PHONY: install test backend-test frontend-test build dev backend-dev frontend-dev

install:
	cd backend && python3 -m venv .venv && .venv/bin/pip install -e '.[dev]'
	cd frontend && npm install

test: backend-test frontend-test

backend-test:
	cd backend && .venv/bin/pytest

frontend-test:
	cd frontend && npm test -- --run

build:
	cd frontend && npm run build

dev:
	docker compose up --build

backend-dev:
	cd backend && .venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

frontend-dev:
	cd frontend && npm run dev
