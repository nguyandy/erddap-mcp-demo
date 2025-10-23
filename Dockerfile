FROM python:3.13-slim

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY erddap_mcp_demo.py .

# Expose port 8000
EXPOSE 8000

# Run the MCP server with streamable-http transport, binding to all interfaces
CMD ["python", "erddap_mcp_demo.py", "--transport", "streamable-http", "--host", "0.0.0.0", "--port", "8000"]
