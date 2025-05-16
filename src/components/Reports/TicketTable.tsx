
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface TicketTableProps {
  selectedCategory: string | null;
}

export const TicketTable: React.FC<TicketTableProps> = ({ selectedCategory }) => {
  const fetchRecurringIssues = async () => {
  // Build our RPC args (we'll pass null for dates until you wire up a dateRange)
  const args = {
    category_filter: selectedCategory && selectedCategory !== 'all'
      ? selectedCategory
      : null,
    date_from: null,
    date_to:   null,
  };

  const { data, error } = await supabase
    .rpc('get_top_recurring_issues', args);

  if (error) {
    console.error('Error fetching recurring issues:', error);
    throw error;
  }

  // Map the result into your table’s shape
  return (data ?? []).map((row, idx) => ({
    id:       idx + 1,
    issue:    row.title,
    category: row.category,
    count:    Number(row.count),
  }));
};


  
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['recurringIssues', selectedCategory],
    queryFn: fetchRecurringIssues
  });
  
  const translateCategory = (category: string) => {
    const categoryMap: Record<string, string> = {
      'hardware': 'Hardware',
      'software': 'Software',
      'redes': 'Red',
      'servidores': 'Servidores',
      'wifi_campus': 'WiFi Campus',
      'acceso_biblioteca': 'Biblioteca',
      'problemas_lms': 'LMS',
      'correo_institucional': 'Correo',
      'sistema_calificaciones': 'Calificaciones',
      'software_academico': 'Software Académico'
    };
    
    return categoryMap[category] || category;
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2">Cargando datos...</span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-4 border border-red-200 bg-red-50 rounded-md">
        <p className="text-red-600">Error al cargar los datos</p>
      </div>
    );
  }
  
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Incidencia</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead className="text-right">Recurrencia</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length > 0 ? (
            data.map((item: any) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.id}</TableCell>
                <TableCell>{item.issue}</TableCell>
                <TableCell>
                  <Badge variant="outline">{translateCategory(item.category)}</Badge>
                </TableCell>
                <TableCell className="text-right">{item.count}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-6">
                No se encontraron datos
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};
