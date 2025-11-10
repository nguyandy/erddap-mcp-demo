'use client';

import { TextField, Box } from '@mui/material';

interface ConfigPanelProps {
  erddapUrl: string;
  onErddapUrlChange: (url: string) => void;
}

export default function ConfigPanel({ erddapUrl, onErddapUrlChange }: ConfigPanelProps) {
  return (
    <Box sx={{ minWidth: 400, maxWidth: 600 }}>
        <TextField
          fullWidth
        size="small"
          label="ERDDAP URL"
          value={erddapUrl}
          onChange={(e) => onErddapUrlChange(e.target.value)}
          placeholder="https://erddap.maracoos.org/erddap"
          autoComplete="off"
          InputLabelProps={{
            sx: {
            fontSize: '0.75rem',
          },
        }}
        sx={{
          '& .MuiInputBase-input': {
              fontSize: '0.85rem',
            },
          }}
        />
      </Box>
  );
}

