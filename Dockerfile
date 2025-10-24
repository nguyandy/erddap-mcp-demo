FROM python:3.13-slim

ENV PATH="/root/.local/bin:${PATH}" \
    UV_LINK_MODE=copy

RUN apt-get update \
    && apt-get install --no-install-recommends -y curl \
    && rm -rf /var/lib/apt/lists/* \
    && curl -LsSf https://astral.sh/uv/install.sh | sh

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project

COPY . .

EXPOSE 8000

CMD ["uv", "run", "erddap_mcp_demo.py", "--transport", "streamable-http", "--host", "0.0.0.0", "--port", "8000"]
