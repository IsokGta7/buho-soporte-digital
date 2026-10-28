import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { ErrorState, EmptyState } from '@/components/StateMessage';

interface LineChartViewProps {
  selectedCategory: string | null;
}

interface ResolutionPoint {
  day: string;
  hours: number;
  resolved: number;
}

const fetchResolutionTimeData = async (category: string | null): Promise<ResolutionPoint[]> => {
  const { data, error } = await supabase.rpc('get_resolution_time_by_day', {
    category_filter: category,
  });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    day: format(parseISO(row.day), 'd MMM', { locale: es }),
    hours: Number(row.avg_hours),
    resolved: Number(row.resolved_count),
  }));
};

export const LineChartView: React.FC<LineChartViewProps> = ({ selectedCategory }) => {
  const category = selectedCategory && selectedCategory !== 'all' ? selectedCategory : null;

  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['resolutionTimeData', category],
    queryFn: () => fetchResolutionTimeData(category)
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        className="h-full"
        message="No se pudo cargar el tiempo de resolución."
        onRetry={() => refetch()}
      />
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        className="h-full"
        message={category ? 'No hay tickets resueltos en esta categoría.' : 'Aún no hay tickets resueltos.'}
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="day" />
        <YAxis label={{ value: 'Horas', angle: -90, position: 'insideLeft' }} />
        <Tooltip formatter={(value) => [`${value} horas`, 'Tiempo promedio']} />
        <Line
          type="monotone"
          dataKey="hours"
          stroke="#3b82f6"
          activeDot={{ r: 8 }}
          name="Tiempo de resolución"
        />
      </LineChart>
    </ResponsiveContainer>
  );
};
