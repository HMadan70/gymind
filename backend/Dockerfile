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

EXPOSE 8000

# --host 0.0.0.0 is required inside a container: 127.0.0.1 would only accept
# connections from *inside* the container itself, which would make it
# unreachable from outside. --reload is handy in dev (auto-restarts on code
# changes) but should come off for a production/server deployment later.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
