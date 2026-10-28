import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ErrorState, EmptyState } from '@/components/StateMessage';

interface BarChartViewProps {
  onCategoryClick: (category: string) => void;
  selectedCategory: string | null;
}

interface CategoryData {
  category: string;
  count: number;
  displayName: string;
}

const categoryMapping: Record<string, string> = {
  'hardware': 'Hardware',
  'software': 'Software',
  'redes': 'Redes',
  'servidores': 'Servidores',
  'wifi_campus': 'WiFi Campus',
  'acceso_biblioteca': 'Biblioteca',
  'problemas_lms': 'LMS',
  'correo_institucional': 'Correo',
  'sistema_calificaciones': 'Calificaciones',
  'software_academico': 'Software Académico',
};

const fetchCategoryData = async (): Promise<CategoryData[]> => {
  const { data, error } = await supabase.rpc('get_tickets_by_category');
  if (error) throw error;
  return (data ?? []).map((item) => ({
    category: item.category,
    displayName: categoryMapping[item.category] || item.category,
    count: Number(item.count),
  }));
};

export const BarChartView: React.FC<BarChartViewProps> = ({ onCategoryClick, selectedCategory }) => {
  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['categoryData'],
    queryFn: fetchCategoryData
  });

  const handleBarClick = (data: any) => {
    if (data && data.activePayload && data.activePayload[0]) {
      onCategoryClick(data.activePayload[0].payload.category);
    }
  };

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
        message="No se pudieron cargar los tickets por categoría."
        onRetry={() => refetch()}
      />
    );
  }

  if (data.length === 0) {
    return <EmptyState className="h-full" message="Aún no hay tickets registrados." />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        onClick={handleBarClick}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="displayName" />
        <YAxis allowDecimals={false} />
        <Tooltip
          cursor={{ fill: '#f3f4f6' }}
          formatter={(value) => [`${value} tickets`, 'Cantidad']}
        />
        <Bar dataKey="count" name="Tickets">
          {data.map((item) => (
            <Cell
              key={item.category}
              fill={selectedCategory === item.category ? '#1e40af' : '#3b82f6'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};
