'use client';

import { useEffect, useRef } from 'react';
import { Box, Link } from '@mui/material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import { parseCsvContent, extractUnit, encodeBase64, colorPalette } from '@/lib/chartUtils';
import { CsvChartData } from '@/types/chat';

ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface ChartRendererProps {
  csvText?: string;
  title?: string;
  fileName?: string;
  mergedData?: CsvChartData[];
}

export default function ChartRenderer({
  csvText,
  title = "Timeseries",
  fileName = "timeseries.csv",
  mergedData,
}: ChartRendererProps) {
  const chartRef = useRef<ChartJS<'line'>>(null);

  // Render merged chart
  if (mergedData && mergedData.length > 0) {
    return <MergedChartRenderer data={mergedData} title={title} />;
  }

  // Render single chart
  if (!csvText) {
    return <Box sx={{ fontStyle: 'italic' }}>No data to render.</Box>;
  }

  const { headers, rows } = parseCsvContent(csvText);
  if (headers.length < 2) {
    return <Box sx={{ fontStyle: 'italic' }}>Unable to render chart: CSV is missing expected columns.</Box>;
  }

  const normalizedHeaders = headers.map((header) => header.toLowerCase());
  const timeIdx = normalizedHeaders.findIndex((header) => header.startsWith("time"));

  // Find all value columns
  const valueIndices: number[] = [];
  normalizedHeaders.forEach((header, idx) => {
    if (idx !== timeIdx && !header.startsWith("id") && header !== "time") {
      valueIndices.push(idx);
    }
  });

  if (timeIdx === -1 || valueIndices.length === 0) {
    return <Box sx={{ fontStyle: 'italic' }}>Unable to render chart: CSV columns are unexpected.</Box>;
  }

  const labels: string[] = [];
  const dataPointsByVariable: (number | null)[][] = valueIndices.map(() => []);

  rows.forEach((cols) => {
    const timeValue = cols[timeIdx];
    const date = new Date(timeValue);
    if (Number.isNaN(date.getTime())) {
      return;
    }

    let hasValidData = false;
    const rowData = valueIndices.map((valueIdx) => {
      const numericValue = Number(cols[valueIdx]);
      if (Number.isFinite(numericValue)) {
        hasValidData = true;
      }
      return numericValue;
    });

    if (!hasValidData) {
      return;
    }

    labels.push(date.toISOString());
    rowData.forEach((value, idx) => {
      dataPointsByVariable[idx].push(Number.isFinite(value) ? value : null);
    });
  });

  if (labels.length === 0) {
    return <Box sx={{ fontStyle: 'italic' }}>Unable to render chart: No valid data rows found.</Box>;
  }

  // Group variables by unit
  const variablesByUnit = new Map<string, Array<{ idx: number; valueIdx: number; varName: string }>>();
  const variableUnits: string[] = [];

  valueIndices.forEach((valueIdx, idx) => {
    const varName = headers[valueIdx];
    const unit = extractUnit(varName) || 'default';
    variableUnits.push(unit);

    if (!variablesByUnit.has(unit)) {
      variablesByUnit.set(unit, []);
    }
    variablesByUnit.get(unit)!.push({ idx, valueIdx, varName });
  });

  // Determine unique units and assign Y-axis IDs
  const uniqueUnits = Array.from(variablesByUnit.keys());
  const unitToAxisId: Record<string, string> = {};

  uniqueUnits.forEach((unit, unitIdx) => {
    const axisId = unitIdx === 0 ? 'y' : `y${unitIdx}`;
    unitToAxisId[unit] = axisId;
  });

  // Create datasets
  const datasets = valueIndices.map((valueIdx, idx) => {
    const color = colorPalette[idx % colorPalette.length];
    const unit = variableUnits[idx];
    const axisId = unitToAxisId[unit];

    return {
      label: headers[valueIdx] || `Variable ${idx + 1}`,
      data: dataPointsByVariable[idx],
      borderColor: color.border,
      backgroundColor: color.background,
      pointRadius: 0,
      tension: 0.2,
      fill: false,
      spanGaps: true,
      yAxisID: axisId,
    };
  });

  // Build Y-axis configuration
  const scales: any = {
    x: {
      type: 'time' as const,
      time: {
        tooltipFormat: 'yyyy-MM-dd HH:mm',
        displayFormats: {
          hour: 'MMM d HH:mm',
          day: 'MMM d',
        },
      },
      ticks: {
        maxRotation: 45,
        minRotation: 45,
        autoSkip: true,
        maxTicksLimit: 10,
      },
    },
  };

  uniqueUnits.forEach((unit, unitIdx) => {
    const axisId = unitToAxisId[unit];
    const varsForThisUnit = variablesByUnit.get(unit)!;
    const firstVarColor = colorPalette[varsForThisUnit[0].idx % colorPalette.length];
    const axisColor = varsForThisUnit.length > 1 ? '#666' : firstVarColor.border;

    scales[axisId] = {
      type: 'linear' as const,
      position: unitIdx === 0 ? 'left' : 'right',
      ticks: {
        precision: 3,
        color: axisColor,
      },
      title: {
        display: uniqueUnits.length > 1 || varsForThisUnit.length > 1,
        text: unit !== 'default' ? unit : '',
        color: axisColor,
      },
      grid: unitIdx > 0 ? { drawOnChartArea: false } : undefined,
    };
  });

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales,
    plugins: {
      legend: {
        display: true,
        position: 'top',
      },
      title: {
        display: true,
        text: title,
      },
    },
  };

  const downloadHref = `data:text/csv;base64,${encodeBase64(csvText)}`;
  const normalizedFileName = fileName.toLowerCase().endsWith('.csv') ? fileName : `${fileName}.csv`;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ position: 'relative', width: '100%', height: 300 }}>
        <Chart ref={chartRef} type="line" data={{ labels, datasets }} options={options} />
      </Box>
      <Box>
        <Link
          href={downloadHref}
          download={normalizedFileName}
          sx={{
            color: 'primary.main',
            textDecoration: 'none',
            fontWeight: 600,
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          Download CSV
        </Link>
      </Box>
    </Box>
  );
}

function MergedChartRenderer({ data, title = "Comparison" }: { data: CsvChartData[]; title: string }) {
  const chartRef = useRef<ChartJS<'line'>>(null);

  if (!data || data.length === 0) {
    return <Box sx={{ fontStyle: 'italic' }}>No data to merge.</Box>;
  }

  // Parse all CSVs
  const parsedData = data.map((item) => {
    const csvText = item.toolContent?.content ?? item.csvText ?? "";
    const filename = item.filename ?? "unknown";
    const datasetName = filename.replace(/\.csv$/i, '').replace(/_/g, ' ');
    const parsed = parseCsvContent(csvText);
    return { ...parsed, datasetName, csvText };
  });

  // Build datasets for chart
  const chartDatasets: any[] = [];
  let colorIdx = 0;
  const allLabels = new Set<string>();
  const dataByTimestamp = new Map<string, Record<string, number>>();

  parsedData.forEach((dataItem) => {
    const { headers, rows, datasetName } = dataItem;
    const normalizedHeaders = headers.map(h => h.toLowerCase());
    const timeIdx = normalizedHeaders.findIndex(h => h.startsWith("time"));

    if (timeIdx === -1) return;

    // Find value columns
    const valueIndices: number[] = [];
    normalizedHeaders.forEach((header, idx) => {
      if (idx !== timeIdx && !header.startsWith("id") && header !== "time") {
        valueIndices.push(idx);
      }
    });

    // Process rows
    rows.forEach((cols) => {
      const timeValue = cols[timeIdx];
      const date = new Date(timeValue);
      if (Number.isNaN(date.getTime())) return;

      const timestamp = date.toISOString();
      allLabels.add(timestamp);

      if (!dataByTimestamp.has(timestamp)) {
        dataByTimestamp.set(timestamp, {});
      }

      valueIndices.forEach((valueIdx) => {
        const varName = headers[valueIdx];
        const numericValue = Number(cols[valueIdx]);
        const key = `${datasetName} - ${varName}`;

        if (Number.isFinite(numericValue)) {
          dataByTimestamp.get(timestamp)![key] = numericValue;
        }
      });
    });

    // Create datasets for each variable in this CSV
    valueIndices.forEach((valueIdx) => {
      const varName = headers[valueIdx];
      const color = colorPalette[colorIdx % colorPalette.length];
      colorIdx++;

      chartDatasets.push({
        label: `${datasetName} - ${varName}`,
        datasetName,
        varName,
        color,
        unit: extractUnit(varName) || 'default',
      });
    });
  });

  // Sort timestamps
  const sortedLabels = Array.from(allLabels).sort();

  // Build data arrays for each dataset
  chartDatasets.forEach((dataset) => {
    const key = `${dataset.datasetName} - ${dataset.varName}`;
    dataset.data = sortedLabels.map(timestamp => {
      const value = dataByTimestamp.get(timestamp)?.[key];
      return value !== undefined ? value : null;
    });
  });

  // Group by unit for multi-axis
  const datasetsByUnit = new Map<string, any[]>();
  chartDatasets.forEach((ds) => {
    if (!datasetsByUnit.has(ds.unit)) {
      datasetsByUnit.set(ds.unit, []);
    }
    datasetsByUnit.get(ds.unit)!.push(ds);
  });

  const uniqueUnits = Array.from(datasetsByUnit.keys());
  const unitToAxisId: Record<string, string> = {};

  uniqueUnits.forEach((unit, unitIdx) => {
    const axisId = unitIdx === 0 ? 'y' : `y${unitIdx}`;
    unitToAxisId[unit] = axisId;
  });

  const finalDatasets = chartDatasets.map((ds) => ({
    label: ds.label,
    data: ds.data,
    borderColor: ds.color.border,
    backgroundColor: ds.color.background,
    pointRadius: 0,
    tension: 0.2,
    fill: false,
    spanGaps: true,
    yAxisID: unitToAxisId[ds.unit],
  }));

  // Build Y-axis configuration
  const scales: any = {
    x: {
      type: 'time' as const,
      time: {
        tooltipFormat: 'yyyy-MM-dd HH:mm',
        displayFormats: {
          hour: 'MMM d HH:mm',
          day: 'MMM d',
        },
      },
      ticks: {
        maxRotation: 45,
        minRotation: 45,
        autoSkip: true,
        maxTicksLimit: 10,
      },
    },
  };

  uniqueUnits.forEach((unit, unitIdx) => {
    const axisId = unitToAxisId[unit];
    const datasetsForThisUnit = datasetsByUnit.get(unit)!;
    const firstDsColor = datasetsForThisUnit[0].color.border;
    const axisColor = datasetsForThisUnit.length > 1 ? '#666' : firstDsColor;

    scales[axisId] = {
      type: 'linear' as const,
      position: unitIdx === 0 ? 'left' : 'right',
      ticks: {
        precision: 3,
        color: axisColor,
      },
      title: {
        display: uniqueUnits.length > 1 || datasetsForThisUnit.length > 1,
        text: unit !== 'default' ? unit : '',
        color: axisColor,
      },
      grid: unitIdx > 0 ? { drawOnChartArea: false } : undefined,
    };
  });

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales,
    plugins: {
      legend: {
        display: true,
        position: 'top',
      },
      title: {
        display: true,
        text: title,
      },
    },
  };

  // Prepare combined CSV
  const combinedCsvHeaders = ['time', ...chartDatasets.map(d => `${d.datasetName} - ${d.varName}`)];
  const combinedCsvRows = sortedLabels.map(timestamp => {
    const row = [timestamp];
    chartDatasets.forEach(dataset => {
      const key = `${dataset.datasetName} - ${dataset.varName}`;
      const value = dataByTimestamp.get(timestamp)?.[key];
      row.push(value !== undefined ? value.toString() : '');
    });
    return row.join(',');
  });
  const combinedCsv = [combinedCsvHeaders.join(','), ...combinedCsvRows].join('\n');
  const downloadHref = `data:text/csv;base64,${encodeBase64(combinedCsv)}`;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ position: 'relative', width: '100%', height: 300 }}>
        <Chart ref={chartRef} type="line" data={{ labels: sortedLabels, datasets: finalDatasets }} options={options} />
      </Box>
      <Box>
        <Link
          href={downloadHref}
          download="comparison.csv"
          sx={{
            color: 'primary.main',
            textDecoration: 'none',
            fontWeight: 600,
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          Download Combined CSV
        </Link>
      </Box>
    </Box>
  );
}

