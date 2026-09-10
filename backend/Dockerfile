FROM python:3.12-slim

WORKDIR /app

# Copy just the requirements file first. Docker caches each instruction as a
# "layer" — as long as requirements.txt hasn't changed, Docker reuses the
# cached "pip install" layer instead of re-running it, so rebuilds after you
# edit app code are much faster.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Now copy the rest of the application code.
COPY app ./app
COPY alembic.ini .
COPY alembic ./alembic

EXPOSE 8000

# Bind to all container interfaces so Docker can publish the service.
# Source reload belongs in a local development command, not the server image.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
