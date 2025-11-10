'use client';

import { useEffect, useRef } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { Message, ContentItem, CsvChartData } from '@/types/chat';
import ChartRenderer from './ChartRenderer';
import { transformSandboxLinks } from '@/lib/chartUtils';

interface ChatTranscriptProps {
  messages: Message[];
  isLoading?: boolean;
  streamingText?: string;
}

export default function ChatTranscript({
  messages,
  isLoading = false,
  streamingText = '',
}: ChatTranscriptProps) {
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages, streamingText]);

  const renderContentItem = (item: ContentItem): React.ReactNode => {
    if (!item || typeof item !== "object") {
      return <pre>{String(item)}</pre>;
    }

    switch (item.type) {
      case "output_text":
      case "input_text":
        return <Box>{transformSandboxLinks(item.text ?? "")}</Box>;
      
      case "tool_call":
      case "tool_use": {
        const name = item.name ?? item.tool_name ?? "tool";
        const args = JSON.stringify(item.input ?? item.arguments ?? {}, null, 2);
        return (
          <Box>
            <strong>Tool Request:</strong> {name}
            <pre style={{ 
              background: '#f0f0f0',
              padding: '12px',
              borderRadius: '6px',
              overflow: 'auto',
              fontSize: '0.8rem',
              lineHeight: 1.4,
              margin: '8px 0 0 0',
              border: '1px solid #e0e0e0',
            }}>
              {args}
            </pre>
          </Box>
        );
      }
      
      case "tool_result":
      case "tool_response": {
        const label = item.tool_call_id ?? item.id ?? "tool";
        const payload = item.result ?? item.output ?? item.content ?? item.text ?? item.data ?? item.value ?? "";
        const mime = item.mime || item.mime_type;
        
        if (mime === "text/csv" || (item as any).filetype === "csv") {
          const csvText = typeof payload === "string" ? payload : item.content ?? "";
          return (
            <Box>
              <strong>Tool Result ({label}):</strong>
              <Box sx={{ mt: 1 }}>
                <ChartRenderer
                  csvText={String(csvText)}
                  title={(item as any).filename ?? "Timeseries"}
                  fileName={(item as any).filename ?? "timeseries.csv"}
                />
              </Box>
            </Box>
          );
        }
        
        const formatted = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
        return (
          <Box>
            <strong>Tool Result ({label}):</strong>
            <pre style={{ 
              background: '#f0f0f0',
              padding: '12px',
              borderRadius: '6px',
              overflow: 'auto',
              fontSize: '0.8rem',
              lineHeight: 1.4,
              margin: '8px 0 0 0',
              border: '1px solid #e0e0e0',
            }}>
              {formatted}
            </pre>
          </Box>
        );
      }
      
      case "file": {
        const mime = item.mime || item.mime_type;
        if (mime === "text/csv") {
          const csvText = item.content ?? item.text ?? "";
          if (!csvText || csvText.trim().length === 0) {
            return <Box><strong>Error:</strong> CSV file has no content</Box>;
          }
          return (
            <ChartRenderer
              csvText={String(csvText)}
              title={item.filename ?? "Timeseries"}
              fileName={item.filename ?? "timeseries.csv"}
            />
          );
        }
        return <Box><strong>File:</strong> {item.filename ?? "attachment"} ({mime ?? "unknown"})</Box>;
      }
      
      case "chart_data": {
        const charts = (item as any).charts as CsvChartData[] || [];
        const shouldMerge = (item as any).shouldMerge || false;
        
        if (charts.length === 0) {
          return null;
        }
        
        if (shouldMerge && charts.length > 1) {
          return (
            <ChartRenderer
              mergedData={charts}
              title="Dataset Comparison"
            />
          );
        }
        
        return (
          <>
            {charts.map((chart, idx) => (
              <Box key={idx} sx={{ mb: idx < charts.length - 1 ? 2 : 0 }}>
                <ChartRenderer
                  csvText={chart.toolContent?.content ?? chart.csvText}
                  title={chart.filename?.replace(/\.csv$/i, '') ?? "Timeseries"}
                  fileName={chart.filename ?? "timeseries.csv"}
                />
              </Box>
            ))}
          </>
        );
      }
      
      default:
        return <pre>{JSON.stringify(item, null, 2)}</pre>;
    }
  };

  const renderMessage = (message: Message, index: number) => {
    const isUser = message.role === 'user';
    const isAssistant = message.role === 'assistant';
    const isTool = message.role === 'system';
    
    // Check if this is a chart message
    const isChartMessage = message.content.some(item => item.type === 'chart_data');

    return (
      <Box
        key={index}
        sx={{
          borderRadius: 2,
          p: isChartMessage ? '12px' : '12px 16px',
          border: '1px solid',
          position: 'relative',
          whiteSpace: isChartMessage ? 'normal' : 'pre-wrap',
          wordWrap: 'break-word',
          lineHeight: isChartMessage ? 1 : 1.5,
          ...(isUser && {
            ml: 'auto',
            maxWidth: '85%',
            bgcolor: 'primary.main',
            color: '#fff',
            borderColor: 'primary.dark',
          }),
          ...(isAssistant && !isChartMessage && {
            mr: 'auto',
            maxWidth: '85%',
            bgcolor: '#f9f9f9',
            borderColor: 'rgba(0, 52, 120, 0.1)',
          }),
          ...(isAssistant && isChartMessage && {
            width: '100%',
            bgcolor: '#f9f9f9',
            borderColor: 'rgba(0, 52, 120, 0.1)',
          }),
          ...(isTool && {
            mr: 'auto',
            maxWidth: '85%',
            bgcolor: 'rgba(0, 52, 120, 0.05)',
            borderColor: 'rgba(0, 52, 120, 0.15)',
            borderLeft: '3px solid',
            borderLeftColor: 'primary.main',
          }),
        }}
      >
        {message.content.map((item, idx) => (
          <Box key={idx}>{renderContentItem(item)}</Box>
        ))}
      </Box>
    );
  };

  return (
    <Box
      ref={transcriptRef}
      sx={{
        maxHeight: 'min(60vh, 500px)',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        pr: 1,
        '&::-webkit-scrollbar': {
          width: '6px',
        },
        '&::-webkit-scrollbar-track': {
          background: 'transparent',
        },
        '&::-webkit-scrollbar-thumb': {
          background: '#d0d0d0',
          borderRadius: '3px',
          '&:hover': {
            background: '#999',
          },
        },
      }}
    >
      {messages.map((message, index) => renderMessage(message, index))}
      
      {isLoading && (
        <Box
          sx={{
            mr: 'auto',
            maxWidth: '85%',
            borderRadius: 2,
            p: '12px 16px',
            bgcolor: '#f9f9f9',
            border: '1px solid rgba(0, 52, 120, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <CircularProgress size={16} />
        </Box>
      )}
      
      {streamingText && (
        <Box
          sx={{
            mr: 'auto',
            maxWidth: '85%',
            borderRadius: 2,
            p: '12px 16px',
            bgcolor: '#f9f9f9',
            border: '1px solid rgba(0, 52, 120, 0.1)',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            lineHeight: 1.5,
          }}
        >
          {streamingText}
        </Box>
      )}
    </Box>
  );
}

