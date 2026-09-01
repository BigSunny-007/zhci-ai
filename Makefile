.PHONY: install test backend-test frontend-test build dev

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

