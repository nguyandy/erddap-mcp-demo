import { NextRequest } from 'next/server';

const DEFAULT_SYSTEM_PROMPT = `You are a helpful assistant that explores ERDDAP datasets for the user. Prefer the configured ERDDAP URL unless the user asks for another. Summarize findings clearly, cite dataset IDs, and link to ERDDAP resources when appropriate. When users ask about data (like "get temperature data"), call get_dataset_variable_data to retrieve it, then provide a natural language summary (e.g., date range, min/max values, trends). Always mention that the user can "plot it" or "visualize it" if they want to see a chart, and that a CSV download is available. Only if the user explicitly asks for a plot/chart/graph/visualization should you mention that a chart is being rendered. Do not reference sandbox:// download links.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, erddapUrl } = body;

    const apiKey = process.env.OPENAI_API_KEY;
    const mcpServerUrl = process.env.MCP_SERVER_URL || 'https://mapapps.oceansmap.com/erddap-mcp';

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const currentTime = new Date().toISOString();
    const systemMessage = {
      role: 'system',
      content: [
        {
          type: 'input_text',
          text: `${DEFAULT_SYSTEM_PROMPT}\nCurrent datetime: ${currentTime}\nDefault ERDDAP endpoint: ${erddapUrl || 'https://erddap.maracoos.org/erddap'}. Use MCP tools when data is required. If the user provides a different ERDDAP, follow their instruction.`
        }
      ]
    };

    const requestBody = {
      model: 'gpt-4.1-mini',
      input: [systemMessage, ...messages],
      tools: [
        {
          type: 'mcp',
          server_label: 'erddap-mcp',
          server_url: mcpServerUrl,
          require_approval: 'never'
        }
      ],
      metadata: {
        erddap_url: erddapUrl || 'https://erddap.maracoos.org/erddap'
      },
      temperature: 0.2,
      stream: true
    };

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Beta': 'tools=v1'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || response.statusText || 'Unknown error';
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Stream the response back to the client
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          try {
          controller.close();
          } catch (e) {
            // Controller already closed
          }
          return;
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Forward the chunks as-is
            try {
            controller.enqueue(value);
            } catch (e) {
              // Controller closed by client, stop streaming
              console.log('Client closed connection');
              break;
            }
          }
        } catch (error) {
          console.error('Stream error:', error);
          try {
            controller.error(error);
          } catch (e) {
            // Controller already closed
          }
        } finally {
          try {
          controller.close();
          } catch (e) {
            // Controller already closed, this is fine
          }
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('API route error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

