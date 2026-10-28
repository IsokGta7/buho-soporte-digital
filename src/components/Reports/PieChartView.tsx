import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ErrorState, EmptyState } from '@/components/StateMessage';

// ticket_feedback.rating runs from 5 (best) to 1 (worst).
const RATINGS: { rating: number; name: string; color: string }[] = [
  { rating: 5, name: 'Muy Satisfecho', color: '#22c55e' },
  { rating: 4, name: 'Satisfecho', color: '#84cc16' },
  { rating: 3, name: 'Neutral', color: '#facc15' },
  { rating: 2, name: 'Insatisfecho', color: '#f97316' },
  { rating: 1, name: 'Muy Insatisfecho', color: '#ef4444' },
];

const fetchSatisfactionData = async () => {
  const { data, error } = await supabase.from('ticket_feedback').select('rating');
  if (error) throw error;

  return RATINGS
    .map(({ rating, name, color }) => ({
      name,
      color,
      value: (data ?? []).filter((row) => row.rating === rating).length,
    }))
    .filter((item) => item.value > 0);
};

export const PieChartView: React.FC = () => {
  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['satisfactionData'],
    queryFn: fetchSatisfactionData
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
        message="No se pudieron cargar las calificaciones de satisfacción."
        onRetry={() => refetch()}
      />
    );
  }

  if (data.length === 0) {
    return <EmptyState className="h-full" message="Aún no hay calificaciones de satisfacción." />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => [`${value} usuarios`, 'Cantidad']} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
};
