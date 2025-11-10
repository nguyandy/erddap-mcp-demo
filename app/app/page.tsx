'use client';

import { useState, useCallback } from 'react';
import { Container, Box, Typography, Paper, Button } from '@mui/material';
import ConfigPanel from './components/ConfigPanel';
import ChatTranscript from './components/ChatTranscript';
import ChatComposer from './components/ChatComposer';
import { Message, CsvChartData } from './types/chat';

export default function Home() {
  const [erddapUrl, setErddapUrl] = useState('https://erddap.maracoos.org/erddap');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [status, setStatus] = useState('');
  const [isError, setIsError] = useState(false);
  const [shouldRenderCharts, setShouldRenderCharts] = useState(false);
  const [cachedCsvData, setCachedCsvData] = useState<CsvChartData[]>([]);
  const [currentCsvCharts, setCurrentCsvCharts] = useState<CsvChartData[]>([]);

  const handleSend = useCallback(async (userText: string) => {
    // Check if user explicitly asks for visualization
    const explicitPlotRequest = /\b(plot|chart|graph|visuali[sz]e|visual)/i.test(userText);
    setShouldRenderCharts(explicitPlotRequest);

    const userMessage: Message = {
      role: 'user',
      content: [{ type: 'input_text', text: userText }]
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);
    setStatus('');
    setIsError(false);
    setStreamingText('');
    setCurrentCsvCharts([]);

    // Build extra messages for explicit plot requests
    const extraMessages: Message[] = [];
    if (explicitPlotRequest) {
      extraMessages.push({
        role: 'system',
        content: [
          {
            type: 'input_text',
            text: 'The user has requested a visualization. You MUST call get_dataset_variable_data with the same parameters (dataset_id, variable_name, start_time, end_time) to retrieve the CSV data. The resulting data will automatically be displayed as an interactive chart. Do not just describe what you would do - actually call the tool now.',
          },
        ],
      });
    }

    try {
      // Filter out chart messages before sending to API (OpenAI doesn't accept custom content types)
      const apiMessages = [...newMessages, ...extraMessages].filter(msg => {
        // Remove messages that only contain chart_data
        return !msg.content.every(item => item.type === 'chart_data');
      }).map(msg => {
        // Remove chart_data items from messages that have mixed content
        return {
          ...msg,
          content: msg.content.filter(item => item.type !== 'chart_data')
        };
      }).filter(msg => msg.content.length > 0); // Remove empty messages

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: apiMessages,
          erddapUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData?.error || response.statusText || 'Unknown error';
        throw new Error(errorMessage);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let currentText = '';
      let newCsvCharts: CsvChartData[] = [];
      let finalAssistantMessage: Message | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('data: [DONE]')) continue;

          const dataLine = trimmed.startsWith('data: ') ? trimmed.substring(6) : trimmed;

          try {
            const data = JSON.parse(dataLine);

            // Handle different streaming event types
            if (data.type === 'response.output_text.delta' && data.delta) {
              currentText += data.delta;
              setStreamingText(currentText);
            } else if (data.type === 'response.output_text.done') {
              // Create final message and add it immediately to prevent flicker
              finalAssistantMessage = {
                role: 'assistant',
                content: [{ type: 'output_text', text: data.text || currentText }]
              };
              setMessages([...newMessages, finalAssistantMessage]);
              setStreamingText('');
            } else if (data.type === 'response.done' || data.type === 'response.completed') {
              if (data.response) {
                // Process full response
                const outputs = Array.isArray(data.response.output)
                  ? data.response.output
                  : Array.isArray(data.response.content)
                  ? data.response.content
                  : [];

                outputs.forEach((entry: any) => {
                  if (!entry) return;

                  if (entry.type === 'message' && entry.message) {
                    // Update with the full message if we have it
                    if (!finalAssistantMessage) {
                      finalAssistantMessage = entry.message;
                      setMessages([...newMessages, entry.message]);
                    }
                    return;
                  }

                  if (entry.type === 'mcp_call') {
                    let toolContent = entry.content ?? entry.output ?? entry.result ?? entry;

                    if (typeof toolContent === 'string') {
                      try {
                        toolContent = JSON.parse(toolContent);
                      } catch (e) {
                        // Keep as string
                      }
                    }

                    if (toolContent?.type === 'file' && toolContent?.mime === 'text/csv') {
                      const chartData: CsvChartData = {
                        toolContent,
                        filename: entry.filename ?? toolContent?.filename,
                        variableName: entry.variable_name ?? toolContent?.variable_name,
                      };
                      newCsvCharts.push(chartData);
                      return;
                    }
                  }
                });
              }
            }
          } catch (e) {
            console.warn('Failed to parse streaming line:', dataLine, e);
          }
        }
      }

      // Finalize streaming text if we never got a done event
      if (currentText && !finalAssistantMessage) {
        finalAssistantMessage = {
          role: 'assistant',
          content: [{ type: 'output_text', text: currentText }]
        };
        setMessages([...newMessages, finalAssistantMessage]);
      }

      // Update cached CSV data
      if (newCsvCharts.length > 0) {
        setCachedCsvData([...cachedCsvData, ...newCsvCharts]);
      }

      // Add charts as a separate message if we should render them
      const chartsToRender = newCsvCharts.length > 0 ? newCsvCharts : (explicitPlotRequest ? cachedCsvData : []);
      if (chartsToRender.length > 0 && (explicitPlotRequest || newCsvCharts.length > 0)) {
        const chartMessage: Message = {
          role: 'assistant',
          content: [{ 
            type: 'chart_data', 
            charts: chartsToRender,
            shouldMerge: chartsToRender.length > 1 && explicitPlotRequest
          } as any]
        };
        
        // Add chart message to history (only if not already added)
        const messagesToAdd: Message[] = [...newMessages];
        if (finalAssistantMessage) {
          messagesToAdd.push(finalAssistantMessage);
        }
        messagesToAdd.push(chartMessage);
        setMessages(messagesToAdd);
      }

    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus(errorMessage);
      setIsError(true);
      
      const errorMsg: Message = {
        role: 'assistant',
        content: [{ type: 'output_text', text: `Error: ${errorMessage}` }]
      };
      setMessages([...newMessages, errorMsg]);
    } finally {
      setIsLoading(false);
      setStreamingText('');
    }
  }, [messages, erddapUrl, cachedCsvData]);

  const handleClear = useCallback(() => {
    setMessages([]);
    setShouldRenderCharts(false);
    setCachedCsvData([]);
    setCurrentCsvCharts([]);
    setStatus('');
    setIsError(false);
    setStreamingText('');
  }, []);

  return (
    <Container maxWidth="md" sx={{ py: 2.5 }}>
      <Box sx={{ mb: 1 }}>
        <Typography
          variant="h1"
          sx={{
            mt: 0,
            mb: 1,
            color: 'primary.main',
          }}
        >
          ERDDAP MCP LLM Demo
        </Typography>
        <Typography
          sx={{
            mt: 0,
            color: 'text.secondary',
            fontSize: '0.95rem',
            lineHeight: 1.6,
            maxWidth: 700,
          }}
        >
          Chat with an OpenAI model that can call the ERDDAP MCP server to explore datasets.
        </Typography>
      </Box>

      <Paper sx={{ p: 3, mb: 1.5 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              flexWrap: 'wrap',
            }}
          >
            <Typography variant="h2" sx={{ m: 0, color: 'primary.main' }}>
              Conversation
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <ConfigPanel erddapUrl={erddapUrl} onErddapUrlChange={setErddapUrl} />
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <ChatTranscript
              messages={messages}
              isLoading={isLoading}
              streamingText={streamingText}
            />

            <ChatComposer
              onSend={handleSend}
              disabled={isLoading}
              status={status}
              isError={isError}
            />
          </Box>
        </Box>
      </Paper>
    </Container>
  );
}

