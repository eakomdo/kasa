# Backend

The Kasa API now lives in its own project: **[`~/Desktop/kasa-api`](../../kasa-api)** (Django 6 + Django REST Framework).

`khaya.py` and `views_example.py` here were the first sketch; the production versions are in
`kasa-api/apps/translate/`. Run the web app against the real API with:

```bash
cd ~/Desktop/kasa-api && .venv/bin/python manage.py runserver 8000
cd ~/Desktop/kasa/frontend && VITE_USE_MOCKS=false VITE_SHOW_DEMO=true npm run dev
```
