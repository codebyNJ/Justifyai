FROM python:3.11-slim

WORKDIR /app

# Install system deps + poetry
RUN apt-get update && apt-get install -y curl && \
    pip install poetry==1.7.1 && \
    rm -rf /var/lib/apt/lists/*

# Copy dependency files
COPY pyproject.toml poetry.lock* ./

# Install dependencies
RUN poetry config virtualenvs.create false && \
    poetry install --no-interaction --no-ansi --no-root

# Copy app code
COPY . .

EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
