export interface ContentItem {
  type: string;
  text?: string;
  content?: string;
  name?: string;
  tool_name?: string;
  input?: any;
  arguments?: any;
  result?: any;
  output?: any;
  data?: any;
  value?: any;
  tool_call_id?: string;
  id?: string;
  mime?: string;
  mime_type?: string;
  filetype?: string;
  filename?: string;
  variable_name?: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: ContentItem[];
}

export interface CsvChartData {
  toolContent?: {
    content?: string;
    filename?: string;
    mime?: string;
    type?: string;
  };
  csvText?: string;
  filename?: string;
  variableName?: string;
}

export interface ChatState {
  messages: Message[];
  shouldRenderCharts: boolean;
  cachedCsvData: CsvChartData[];
}

export interface StreamingMessageHandle {
  appendText: (text: string) => void;
  setHTML: (html: string) => void;
  finalize: () => void;
  remove: () => void;
}

