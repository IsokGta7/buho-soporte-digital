import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { BarChart, FileText, Users, Settings, Clock, Calendar, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { addDays, format, isSameDay, startOfDay, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { ErrorState, EmptyState } from '@/components/StateMessage';
import { FEATURES } from '@/config/features';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface ChartDataItem {
  name: string;
  value: number;
}

interface DailyTrendItem {
  name: string;
  nuevos: number;
  resueltos: number;
}

const statusMapping: Record<string, string> = {
  'nuevo': 'Nuevos',
  'asignado': 'Asignados',
  'en_progreso': 'En Progreso',
  'resuelto': 'Resueltos',
  'cerrado': 'Cerrados'
};

const categoryMapping: Record<string, string> = {
  'hardware': 'Hardware',
  'software': 'Software',
  'redes': 'Redes',
  'wifi_campus': 'WiFi Campus',
  'acceso_biblioteca': 'Biblioteca',
  'sistema_calificaciones': 'Calificaciones',
  'correo_institucional': 'Correo',
  'servidores': 'Servidores'
};

const roleMapping: Record<string, string> = {
  'student': 'Estudiantes',
  'professor': 'Profesores',
  'technician': 'Técnicos',
  'admin': 'Administradores'
};

const fetchTicketsByStatus = async (): Promise<ChartDataItem[]> => {
  const { data, error } = await supabase.rpc('get_tickets_by_status');
  if (error) throw error;
  return (data ?? []).map((item) => ({
    name: statusMapping[item.status] || item.status,
    value: Number(item.count)
  }));
};

const fetchTicketsByCategory = async (): Promise<ChartDataItem[]> => {
  const { data, error } = await supabase.rpc('get_tickets_by_category');
  if (error) throw error;
  return (data ?? []).map((item) => ({
    name: categoryMapping[item.category] || item.category,
    value: Number(item.count)
  }));
};

const fetchUsersByRole = async (): Promise<ChartDataItem[]> => {
  const { data, error } = await supabase.rpc('get_users_by_role');
  if (error) throw error;
  return (data ?? []).map((item) => ({
    name: roleMapping[item.role] || item.role,
    value: Number(item.count)
  }));
};

// Average hours from creation to resolution over every resolved ticket, or
// null when nothing has been resolved yet.
const fetchAverageResolutionHours = async (): Promise<number | null> => {
  const { data, error } = await supabase.rpc('get_resolution_time_by_day');
  if (error) throw error;
  const rows = data ?? [];
  const resolved = rows.reduce((sum, row) => sum + Number(row.resolved_count), 0);
  if (resolved === 0) return null;
  const totalHours = rows.reduce(
    (sum, row) => sum + Number(row.avg_hours) * Number(row.resolved_count),
    0
  );
  return totalHours / resolved;
};

// Tickets created and resolved on each of the last seven days.
const fetchDailyTrend = async (): Promise<DailyTrendItem[]> => {
  const since = startOfDay(subDays(new Date(), 6));

  const [created, resolved] = await Promise.all([
    supabase.from('tickets').select('created_at').gte('created_at', since.toISOString()),
    supabase.from('tickets').select('resolved_at').gte('resolved_at', since.toISOString()),
  ]);
  if (created.error) throw created.error;
  if (resolved.error) throw resolved.error;

  return Array.from({ length: 7 }, (_, i) => addDays(since, i)).map((day) => ({
    name: format(day, 'EEE d', { locale: es }),
    nuevos: (created.data ?? []).filter((t) => isSameDay(new Date(t.created_at), day)).length,
    resueltos: (resolved.data ?? []).filter(
      (t) => t.resolved_at && isSameDay(new Date(t.resolved_at), day)
    ).length,
  }));
};

// Placeholder distribution, shown only while FEATURES.responseTimeChart is on;
// nothing records first-response times yet.
const generateResponseTimeData = () => {
  return [
    { name: '<1h', value: 27 },
    { name: '<4h', value: 42 },
    { name: '<12h', value: 18 },
    { name: '<24h', value: 8 },
    { name: '>24h', value: 5 },
  ];
};

const Loading: React.FC = () => (
  <div className="flex h-full items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
  </div>
);

// Loading, error or empty state for a chart, or the chart itself.
function ChartState<T>({
  query,
  errorMessage,
  emptyMessage,
  isEmpty,
  children,
}: {
  query: UseQueryResult<T>;
  errorMessage: string;
  emptyMessage: string;
  isEmpty: (data: T) => boolean;
  children: (data: T) => React.ReactNode;
}) {
  if (query.isPending) return <Loading />;
  if (query.isError) {
    return <ErrorState className="h-full" message={errorMessage} onRetry={() => query.refetch()} />;
  }
  if (isEmpty(query.data)) return <EmptyState className="h-full" message={emptyMessage} />;
  return <>{children(query.data)}</>;
}

// The figure for a KPI card: a spinner, a dash with a retry link, or the value.
function KpiValue<T>({
  query,
  render,
}: {
  query: UseQueryResult<T>;
  render: (data: T) => React.ReactNode;
}) {
  if (query.isPending) return <Loader2 className="h-6 w-6 animate-spin text-gray-400" />;
  if (query.isError) {
    return (
      <span className="flex items-center gap-2">
        —
        <Button variant="link" size="sm" className="h-auto p-0 text-red-600" onClick={() => query.refetch()}>
          Error al cargar. Reintentar
        </Button>
      </span>
    );
  }
  return <>{render(query.data)}</>;
}

const sumValues = (items: ChartDataItem[]) => items.reduce((sum, item) => sum + item.value, 0);

const AdminDashboard = () => {
  const navigate = useNavigate();

  const ticketsByStatus = useQuery({
    queryKey: ['ticketsByStatus'],
    queryFn: fetchTicketsByStatus,
  });

  const ticketsByCategory = useQuery({
    queryKey: ['ticketsByCategory'],
    queryFn: fetchTicketsByCategory,
  });

  const usersByRole = useQuery({
    queryKey: ['usersByRole'],
    queryFn: fetchUsersByRole,
  });

  const averageResolution = useQuery({
    queryKey: ['averageResolutionHours'],
    queryFn: fetchAverageResolutionHours,
  });

  const dailyTrend = useQuery({
    queryKey: ['dailyTicketTrend'],
    queryFn: fetchDailyTrend,
  });

  const responseTimeData = generateResponseTimeData();

  // Pie chart colors
  const STATUS_COLORS = ['#3b82f6', '#6366f1', '#f59e0b', '#22c55e', '#6b7280'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Dashboard de Administración</h2>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => navigate('/reports')}>
            <BarChart className="mr-2 h-4 w-4" /> Ver Reportes Completos
          </Button>
          <Button className="bg-unison-blue hover:bg-blue-700" onClick={() => navigate('/users')}>
            <Users className="mr-2 h-4 w-4" /> Gestionar Usuarios
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className={`grid grid-cols-1 gap-4 ${FEATURES.slaRules ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tickets Totales</CardDescription>
            <CardTitle className="text-3xl">
              <KpiValue query={ticketsByStatus} render={(data) => sumValues(data)} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">Todos los estados</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Usuarios Registrados</CardDescription>
            <CardTitle className="text-3xl">
              <KpiValue query={usersByRole} render={(data) => sumValues(data)} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">Todos los roles</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tiempo de Resolución</CardDescription>
            <CardTitle className="text-3xl">
              <KpiValue
                query={averageResolution}
                render={(hours) =>
                  hours === null ? 'Sin datos' : `${(hours / 24).toFixed(1)} días`
                }
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">Promedio de tickets resueltos</div>
          </CardContent>
        </Card>
        {FEATURES.slaRules && (
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Cumplimiento SLA</CardDescription>
              <CardTitle className="text-3xl">Sin datos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-sm">
                <Progress className="h-2 flex-1" value={0} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Tickets by Status */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Estado de Tickets</CardTitle>
            <CardDescription>Distribución por estado actual</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center">
              <ChartState
                query={ticketsByStatus}
                errorMessage="No se pudo cargar la distribución por estado."
                emptyMessage="Aún no hay tickets registrados."
                isEmpty={(data) => data.length === 0}
              >
                {(data) => (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {data.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} tickets`, 'Cantidad']} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartState>
            </div>
          </CardContent>
        </Card>

        {/* Daily Ticket Trend */}
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle>Tendencia de Tickets</CardTitle>
            <CardDescription>Nuevos vs. resueltos por día, últimos 7 días</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ChartState
                query={dailyTrend}
                errorMessage="No se pudo cargar la tendencia de tickets."
                emptyMessage="No hubo tickets nuevos ni resueltos en los últimos 7 días."
                isEmpty={(data) => data.every((day) => day.nuevos === 0 && day.resueltos === 0)}
              >
                {(data) => (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Area type="monotone" dataKey="nuevos" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} name="Nuevos" />
                      <Area type="monotone" dataKey="resueltos" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} name="Resueltos" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </ChartState>
            </div>
          </CardContent>
        </Card>

        {/* Tickets by Category */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Categorías</CardTitle>
            <CardDescription>Distribución por tipo de incidencia</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ChartState
                query={ticketsByCategory}
                errorMessage="No se pudo cargar la distribución por categoría."
                emptyMessage="Aún no hay tickets registrados."
                isEmpty={(data) => data.length === 0}
              >
                {(data) => (
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart
                      data={data}
                      layout="vertical"
                      margin={{ top: 10, right: 30, left: 80, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis dataKey="name" type="category" width={80} />
                      <Tooltip formatter={(value) => [`${value} tickets`, 'Cantidad']} />
                      <Bar dataKey="value" fill="#6366f1" />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                )}
              </ChartState>
            </div>
          </CardContent>
        </Card>

        {/* Response Time */}
        {FEATURES.responseTimeChart && (
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Tiempo de Respuesta</CardTitle>
              <CardDescription>Distribución de tiempos de primera respuesta</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={responseTimeData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {responseTimeData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            index === 0 ? '#22c55e' :
                            index === 1 ? '#84cc16' :
                            index === 2 ? '#eab308' :
                            index === 3 ? '#f59e0b' :
                            '#ef4444'
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value}%`, 'Porcentaje']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* User Distribution */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Usuarios por Rol</CardTitle>
            <CardDescription>Distribución de usuarios registrados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ChartState
                query={usersByRole}
                errorMessage="No se pudo cargar la distribución de usuarios."
                emptyMessage="Aún no hay usuarios registrados."
                isEmpty={(data) => data.length === 0}
              >
                {(data) => (
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart
                      data={data}
                      margin={{ top: 10, right: 30, left: 80, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip formatter={(value) => [`${value} usuarios`, 'Cantidad']} />
                      <Bar dataKey="value" fill="#8b5cf6" />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                )}
              </ChartState>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Acciones Rápidas</CardTitle>
            <CardDescription>Tareas de administración comunes</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button onClick={() => navigate('/users')} variant="outline" className="justify-start">
              <Users className="mr-2 h-4 w-4" />
              Gestionar Usuarios
            </Button>
            <Button onClick={() => navigate('/reports')} variant="outline" className="justify-start">
              <FileText className="mr-2 h-4 w-4" />
              Generar Reportes
            </Button>
            <Button onClick={() => navigate('/config')} variant="outline" className="justify-start">
              <Settings className="mr-2 h-4 w-4" />
              Configuración del Sistema
            </Button>
          </CardContent>
        </Card>

        {/* System Status */}
        {FEATURES.systemHealth && (
          <Card>
            <CardHeader>
              <CardTitle>Estado del Sistema</CardTitle>
              <CardDescription>Monitoreo de servicios</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                  <span>API de Tickets</span>
                </div>
                <span className="text-xs text-muted-foreground">100%</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                  <span>Autenticación</span>
                </div>
                <span className="text-xs text-muted-foreground">99.9%</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                  <span>Almacenamiento</span>
                </div>
                <span className="text-xs text-muted-foreground">100%</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-yellow-500 mr-2"></div>
                  <span>Notificaciones</span>
                </div>
                <span className="text-xs text-muted-foreground">98.2%</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upcoming Maintenance */}
        {FEATURES.maintenanceSchedule && (
          <Card>
            <CardHeader>
              <CardTitle>Mantenimiento Programado</CardTitle>
              <CardDescription>Próximos eventos de mantenimiento</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 border border-gray-200 rounded">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">Actualización de BD</div>
                    <div className="flex items-center">
                      <Calendar className="h-3 w-3 mr-1" />
                      <span className="text-xs">15 Jun</span>
                    </div>
                  </div>
                  <div className="flex items-center mt-1">
                    <Clock className="h-3 w-3 mr-1" />
                    <span className="text-xs text-muted-foreground">22:00 - 02:00</span>
                  </div>
                </div>
                <div className="p-3 border border-gray-200 rounded">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">Backup del Sistema</div>
                    <div className="flex items-center">
                      <Calendar className="h-3 w-3 mr-1" />
                      <span className="text-xs">20 Jun</span>
                    </div>
                  </div>
                  <div className="flex items-center mt-1">
                    <Clock className="h-3 w-3 mr-1" />
                    <span className="text-xs text-muted-foreground">01:00 - 03:00</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
