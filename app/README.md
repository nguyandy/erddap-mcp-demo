# ERDDAP MCP Chat - Next.js Application

A Next.js + Material UI application for chatting with an OpenAI model that can call the ERDDAP MCP server to explore oceanographic datasets.

## Features

- 🤖 Chat interface with OpenAI GPT-4.1-mini
- 📊 Interactive Chart.js visualizations for timeseries data
- 🌊 Integration with ERDDAP MCP server for dataset exploration
- 📥 CSV data download functionality
- 🎨 Material UI components with custom theming
- ⚡ Streaming responses for real-time chat experience
- 📈 Multi-axis chart support for different units
- 🔄 Merged chart view for comparing multiple datasets

## Setup

### Prerequisites

- Node.js 18+ or Bun
- OpenAI API key

### Installation

1. Install dependencies:

```bash
npm install
# or
bun install
```

2. Create a `.env.local` file in the `app` directory:

```env
OPENAI_API_KEY=sk-your-api-key-here
MCP_SERVER_URL=https://mapapps.oceansmap.com/erddap-mcp
```

### Development

Run the development server:

```bash
npm run dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production

Build and start the production server:

```bash
npm run build
npm start
# or
bun run build
bun start
```

### Docker

Run the application using Docker Compose:

```bash
# Using environment variables
OPENAI_API_KEY=sk-your-key-here docker-compose up -d

# Or create a .env.local file with your API key
echo "OPENAI_API_KEY=sk-your-key-here" > .env.local
echo "MCP_SERVER_URL=https://mapapps.oceansmap.com/erddap-mcp" >> .env.local

# Then uncomment the env_file section in docker-compose.yml and run:
docker-compose up -d
```

Build the Docker image manually:

```bash
docker build -t erddap-mcp-chat .
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=sk-your-key-here \
  -e MCP_SERVER_URL=https://mapapps.oceansmap.com/erddap-mcp \
  erddap-mcp-chat
```

Stop the container:

```bash
docker-compose down
```

## Project Structure

```
/app
  /api/chat/route.ts       # OpenAI API endpoint with streaming
  /components/
    ChatComposer.tsx       # User input component
    ChatTranscript.tsx     # Message display component
    ChartRenderer.tsx      # Chart.js visualization component
    ConfigPanel.tsx        # ERDDAP URL configuration
  /lib/
    chartUtils.ts          # CSV parsing and chart utilities
  /styles/
    theme.ts               # Material UI theme configuration
  /types/
    chat.ts                # TypeScript type definitions
  layout.tsx               # Root layout with ThemeProvider
  page.tsx                 # Main chat interface page
```

## Usage

1. The ERDDAP URL can be configured in the Configuration panel (defaults to MARACOOS ERDDAP)
2. Type your questions about datasets, variables, or time ranges in the chat input
3. The assistant will use MCP tools to query ERDDAP and provide results
4. To visualize data, explicitly ask to "plot", "chart", or "visualize" the data
5. Download CSV data using the provided links in chart views

## Environment Variables

- `OPENAI_API_KEY` (required): Your OpenAI API key
- `MCP_SERVER_URL` (optional): MCP server URL (defaults to https://mapapps.oceansmap.com/erddap-mcp)

## Technology Stack

- **Framework**: Next.js 14 (App Router)
- **UI Library**: Material UI 5
- **Charts**: Chart.js with react-chartjs-2
- **Language**: TypeScript
- **Styling**: Material UI theming + sx props

## Notes

- The OpenAI API key is stored server-side and never exposed to the client
- MCP server URL is also kept server-side for security
- Charts automatically support multiple Y-axes for different units
- Streaming responses provide real-time feedback during API calls

