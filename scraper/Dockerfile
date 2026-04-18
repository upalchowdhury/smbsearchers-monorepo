FROM mcr.microsoft.com/playwright/python:v1.58.0-noble

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV MALLOC_ARENA_MAX=2 \
    PYTHONUNBUFFERED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Default: run all sources once (best paired with Railway Cron service type)
CMD ["python", "run.py", "--source", "all", "--pages", "20"]
