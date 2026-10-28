import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangePicker } from '@/components/Reports/DateRangePicker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChartView } from '@/components/Reports/BarChartView';
import { LineChartView } from '@/components/Reports/LineChartView';
import { PieChartView } from '@/components/Reports/PieChartView';
import { TicketTable } from '@/components/Reports/TicketTable';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { BarChart, LineChart, PieChart, FileText, Files, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DateRange } from 'react-day-picker';
import { useQuery } from '@tanstack/react-query';
import { endOfDay, format, startOfDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { exportToCSV, exportToPDF, type ExportColumn } from '@/utils/exportUtils';
import {
  adminCategories,
  translateCategory,
  translatePriority,
  translateStatus,
} from '@/types';
import { ErrorState } from '@/components/StateMessage';
import { FEATURES } from '@/config/features';

interface ReportFilters {
  from?: Date;
  to?: Date;
  category: string | null;
}

const exportColumns: ExportColumn[] = [
  { header: 'Número', key: 'numero' },
  { header: 'Título', key: 'titulo' },
  { header: 'Categoría', key: 'categoria' },
  { header: 'Prioridad', key: 'prioridad' },
  { header: 'Estado', key: 'estado' },
  { header: 'Fecha de creación', key: 'creacion' },
];

// Every ticket category, once each, in the order the ticket form lists them.
const categories = Array.from(new Set(adminCategories)).map((id) => ({
  id,
  name: translateCategory(id),
}));

// Tickets created in the selected period and category.
const filteredTickets = (filters: ReportFilters, columns: string, head = false) => {
  let query = supabase
    .from('tickets')
    .select(columns, head ? { count: 'exact', head: true } : undefined);
  if (filters.from) query = query.gte('created_at', startOfDay(filters.from).toISOString());
  if (filters.to) query = query.lte('created_at', endOfDay(filters.to).toISOString());
  if (filters.category) query = query.eq('category', filters.category);
  return query;
};

const fetchSummary = async (filters: ReportFilters) => {
  const [countResult, resolutionResult] = await Promise.all([
    filteredTickets(filters, 'id', true),
    supabase.rpc('get_resolution_time_by_day', {
      category_filter: filters.category,
      date_from: filters.from ? format(filters.from, 'yyyy-MM-dd') : null,
      date_to: filters.to ? format(filters.to, 'yyyy-MM-dd') : null,
    }),
  ]);
  if (countResult.error) throw countResult.error;
  if (resolutionResult.error) throw resolutionResult.error;

  const rows = resolutionResult.data ?? [];
  const resolved = rows.reduce((sum, row) => sum + Number(row.resolved_count), 0);
  const totalHours = rows.reduce(
    (sum, row) => sum + Number(row.avg_hours) * Number(row.resolved_count),
    0
  );

  return {
    totalTickets: countResult.count ?? 0,
    avgResolutionHours: resolved > 0 ? totalHours / resolved : null,
  };
};

const fetchExportRows = async (filters: ReportFilters) => {
  const { data, error } = await filteredTickets(
    filters,
    'ticket_number, title, category, priority, status, created_at'
  ).order('created_at', { ascending: false });
  if (error) throw error;

  return ((data ?? []) as unknown as {
    ticket_number: string;
    title: string;
    category: string;
    priority: Parameters<typeof translatePriority>[0];
    status: Parameters<typeof translateStatus>[0];
    created_at: string;
  }[]).map((ticket) => ({
    numero: ticket.ticket_number,
    titulo: ticket.title,
    categoria: translateCategory(ticket.category),
    prioridad: translatePriority(ticket.priority),
    estado: translateStatus(ticket.status),
    creacion: format(new Date(ticket.created_at), 'yyyy-MM-dd'),
  }));
};

const formatHours = (hours: number) =>
  hours < 24 ? `${hours.toFixed(1)} h` : `${(hours / 24).toFixed(1)} días`;

export const ReportsContent: React.FC = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
    to: new Date(),
  });
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filters: ReportFilters = {
    from: dateRange?.from,
    to: dateRange?.to,
    category: categoryFilter === 'all' ? null : categoryFilter,
  };

  const summary = useQuery({
    queryKey: ['reportSummary', filters.from?.toDateString(), filters.to?.toDateString(), filters.category],
    queryFn: () => fetchSummary(filters),
  });

  const runExport = async (kind: 'csv' | 'pdf') => {
    setIsLoading(true);
    try {
      const rows = await fetchExportRows(filters);
      if (rows.length === 0) {
        toast.info('No hay tickets para exportar con los filtros seleccionados');
        return;
      }
      if (kind === 'csv') {
        exportToCSV(rows, 'tickets-reporte');
      } else {
        exportToPDF(rows, 'tickets-reporte', exportColumns);
      }
    } catch (error) {
      console.error('Error al obtener los tickets para exportar:', error);
      toast.error('No se pudieron obtener los tickets para exportar');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle chart category click
  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category === selectedCategory ? null : category);
    toast.info(`Filtrado por categoría: ${translateCategory(category)}`);
  };

  const periodLabel = dateRange?.from && dateRange?.to
    ? `${new Date(dateRange.from).toLocaleDateString()} - ${new Date(dateRange.to).toLocaleDateString()}`
    : 'Todo el periodo';

  const renderSummaryValue = (render: (data: NonNullable<typeof summary.data>) => React.ReactNode) => {
    if (summary.isPending) return <Loader2 className="h-6 w-6 animate-spin text-gray-400" />;
    if (summary.isError) return '—';
    return render(summary.data);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Reportes</h1>
        <div className="flex gap-2">
          <Button onClick={() => runExport('csv')} disabled={isLoading} variant="outline">
            <Files className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
          <Button onClick={() => runExport('pdf')} disabled={isLoading} variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Ajusta los filtros para personalizar los reportes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Rango de Fechas</label>
              <DateRangePicker date={dateRange} onDateChange={setDateRange} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Rol de Usuario</label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los roles</SelectItem>
                  <SelectItem value="student">Estudiante</SelectItem>
                  <SelectItem value="professor">Profesor</SelectItem>
                  <SelectItem value="technician">Técnico</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Categoría</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary KPIs */}
      {summary.isError && (
        <ErrorState
          message="No se pudo cargar el resumen del periodo."
          onRetry={() => summary.refetch()}
        />
      )}
      <div className={`grid grid-cols-1 gap-4 ${FEATURES.slaRules ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de tickets</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <div className="text-3xl font-bold">
                {renderSummaryValue((data) => data.totalTickets)}
              </div>
              <Badge variant="outline" className="bg-soft-blue">{periodLabel}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tiempo promedio de resolución</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <div className="text-3xl font-bold">
                {renderSummaryValue((data) =>
                  data.avgResolutionHours === null ? 'Sin datos' : formatHours(data.avgResolutionHours)
                )}
              </div>
              <Badge variant="outline" className="bg-soft-purple">Tickets resueltos en el periodo</Badge>
            </div>
          </CardContent>
        </Card>

        {FEATURES.slaRules && (
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Cumplimiento de SLA</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">Sin datos</div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Charts & Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart className="mr-2 h-5 w-5" />
              Tickets por Categoría
            </CardTitle>
            <CardDescription>Distribución de tickets por tipo de incidencia</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <BarChartView onCategoryClick={handleCategoryClick} selectedCategory={selectedCategory} />
          </CardContent>
        </Card>

        {/* Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <LineChart className="mr-2 h-5 w-5" />
              Tiempo de Resolución
            </CardTitle>
            <CardDescription>Tiempo promedio de resolución diario</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <LineChartView selectedCategory={selectedCategory} />
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <PieChart className="mr-2 h-5 w-5" />
              Satisfacción del Usuario
            </CardTitle>
            <CardDescription>Basado en encuestas post-resolución</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <PieChartView />
          </CardContent>
        </Card>

        {/* Table with Top Issues */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Incidencias Recurrentes</CardTitle>
            <CardDescription>Las incidencias más reportadas en el período</CardDescription>
          </CardHeader>
          <CardContent>
            <TicketTable selectedCategory={selectedCategory} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
