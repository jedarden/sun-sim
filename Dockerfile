# Sun Simulator - Lightweight Docker Container
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy application files
COPY index.html .
COPY serve.py .
COPY docs/ ./docs/

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:3000')"

# Run the server
CMD ["python3", "serve.py", "3000"]
