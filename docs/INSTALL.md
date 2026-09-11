# Instalação — INVEST

## Requisitos
- Python 3.11+, Node 18+, Yarn, MongoDB

## Backend
```bash
cd backend
cp .env.example .env      # configurar MONGO_URL, DB_NAME, JWT_SECRET, ADMIN_EMAIL/PASSWORD, EMERGENT_LLM_KEY
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001
```
Ao arrancar, o backend cria automaticamente o admin e o agente de demonstração e inicia o scheduler de expiração.

## Frontend
```bash
cd frontend
cp .env.example .env      # definir REACT_APP_BACKEND_URL
yarn install
yarn start
```

## Produção (supervisor)
Os serviços `backend` e `frontend` são geridos por supervisor. Reiniciar:
```bash
sudo supervisorctl restart backend frontend
```
