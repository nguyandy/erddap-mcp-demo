'use client';

import { useState, KeyboardEvent } from 'react';
import { Box, TextField, Button, Typography } from '@mui/material';

interface ChatComposerProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  status?: string;
  isError?: boolean;
}

export default function ChatComposer({
  onSend,
  disabled = false,
  status = '',
  isError = false,
}: ChatComposerProps) {
  const [input, setInput] = useState('');

  const handleSubmit = () => {
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Box
      sx={{
        borderTop: '1px solid #e0e0e0',
        pt: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      <TextField
        fullWidth
        multiline
        minRows={4}
        placeholder="Ask about datasets, variables, or time ranges..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        sx={{
          '& .MuiInputBase-root': {
            fontFamily: 'inherit',
          },
        }}
      />
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.5,
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
      >
        <Typography
          variant="body2"
          sx={{
            mr: 'auto',
            minHeight: '1.2em',
            fontWeight: 500,
            color: isError ? '#d63031' : '#525e75',
          }}
        >
          {status}
        </Typography>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={disabled || !input.trim()}
        >
          Send
        </Button>
      </Box>
    </Box>
  );
}

