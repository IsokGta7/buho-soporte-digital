import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { ErrorState, EmptyState } from '@/components/StateMessage';

interface TicketStats {
  total: number;
  new: number;
  inProgress: number;
  resolved: number;
  closed: number;
  assigned: number;
  highPriority: number;
}

export const TechnicianDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Fetch assigned tickets for the technician
  const fetchAssignedTickets = async () => {
    if (!user) return [];
    
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('assigned_to_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);
      
    if (error) {
      console.error('Error fetching assigned tickets:', error);
      throw error;
    }
    
    return data || [];
  };
  
  // Fetch pending tickets that need assignment
  const fetchPendingTickets = async () => {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('status', 'nuevo')
      .order('created_at', { ascending: true })
      .limit(5);
      
    if (error) {
      console.error('Error fetching pending tickets:', error);
      throw error;
    }
    
    return data || [];
  };
  
  // Fetch ticket statistics. The status counts cover the tickets this
  // technician can see: their own and the open queue.
  const fetchTicketStats = async (): Promise<TicketStats> => {
    if (!user) throw new Error('Usuario no autenticado');

    const [statusResult, assignedResult] = await Promise.all([
      supabase.rpc('get_tickets_by_status'),
      supabase.from('tickets').select('id, priority, status').eq('assigned_to_id', user.id),
    ]);

    if (statusResult.error) throw statusResult.error;
    if (assignedResult.error) throw assignedResult.error;

    const statusCounts = statusResult.data ?? [];
    const assigned = assignedResult.data ?? [];
    const countFor = (status: string) =>
      Number(statusCounts.find((item) => item.status === status)?.count ?? 0);

    return {
      total: statusCounts.reduce((sum, item) => sum + Number(item.count), 0),
      new: countFor('nuevo'),
      inProgress: countFor('en_progreso'),
      resolved: countFor('resuelto'),
      closed: countFor('cerrado'),
      assigned: assigned.length,
      highPriority: assigned.filter(
        (t) => (t.priority === 'alta' || t.priority === 'crítica')
          && t.status !== 'resuelto' && t.status !== 'cerrado'
      ).length,
    };
  };

  // Latest history entries on the tickets this technician can see.
  const fetchRecentActivity = async () => {
    const { data, error } = await supabase
      .from('ticket_history')
      .select('id, action, created_at, tickets(ticket_number)')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw error;
    return data ?? [];
  };

  const { data: assignedTickets = [], isLoading: isLoadingAssigned, isError: isAssignedError, refetch: refetchAssigned } = useQuery({
    queryKey: ['technicianAssignedTickets', user?.id],
    queryFn: fetchAssignedTickets,
    enabled: !!user,
  });
  
  const { data: pendingTickets = [], isLoading: isLoadingPending, isError: isPendingError, refetch: refetchPending } = useQuery({
    queryKey: ['pendingTickets'],
    queryFn: fetchPendingTickets,
  });
  
  const { data: ticketStats, isLoading: isLoadingStats, isError: isStatsError, refetch: refetchStats } = useQuery({
    queryKey: ['ticketStats', user?.id],
    queryFn: fetchTicketStats,
    enabled: !!user,
  });

  const { data: recentActivity = [], isLoading: isLoadingActivity, isError: isActivityError, refetch: refetchActivity } = useQuery({
    queryKey: ['technicianRecentActivity', user?.id],
    queryFn: fetchRecentActivity,
    enabled: !!user,
  });
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'nuevo':
        return 'bg-blue-100 text-blue-800';
      case 'asignado':
        return 'bg-purple-100 text-purple-800';
      case 'en_progreso':
        return 'bg-yellow-100 text-yellow-800';
      case 'resuelto':
        return 'bg-green-100 text-green-800';
      case 'cerrado':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const renderTicketItem = (ticket: any, showAssign = false) => (
    <div key={ticket.id} className="p-3 bg-gray-50 rounded-md hover:bg-gray-100">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-medium">{ticket.title}</p>
          <p className="text-xs text-muted-foreground">
            #{ticket.ticket_number} • {new Date(ticket.created_at).toLocaleDateString('es-MX')}
          </p>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
          {ticket.status === 'nuevo' ? 'Nuevo' : 
          ticket.status === 'asignado' ? 'Asignado' :
          ticket.status === 'en_progreso' ? 'En Progreso' : 
          ticket.status === 'resuelto' ? 'Resuelto' : 
          ticket.status === 'cerrado' ? 'Cerrado' : ticket.status}
        </span>
      </div>
      {showAssign && (
        <div className="mt-2">
          <Button 
            size="sm" 
            variant="default" 
            className="w-full bg-unison-blue hover:bg-blue-700"
            onClick={() => navigate('/tickets/assigned')}
          >
            Asignarme
          </Button>
        </div>
      )}
    </div>
  );
  
  // The stats feed two sections, so wait for them before drawing the page.
  if (isLoadingStats) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400 mr-2" />
        <span>Cargando dashboard...</span>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold">Dashboard de Técnico</h2>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => navigate('/tickets')}
          >
            Ver Todos los Tickets
          </Button>
          <Button 
            className="bg-unison-blue hover:bg-blue-700"
            onClick={() => navigate('/tickets/assigned')}
          >
            Mis Asignaciones
          </Button>
        </div>
      </div>
      
      {/* Stats Cards */}
      {isStatsError || !ticketStats ? (
        <ErrorState
          message="No se pudieron cargar las estadísticas de tickets."
          onRetry={() => refetchStats()}
        />
      ) : (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tickets Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{ticketStats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tickets Nuevos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{ticketStats.new}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">En Progreso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{ticketStats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resueltos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{ticketStats.resolved}</div>
          </CardContent>
        </Card>
      </div>
      )}
      
      {/* Main Content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Assigned Tickets */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Mis Tickets Asignados</CardTitle>
            <CardDescription>Tickets que requieren tu atención</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingAssigned ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : isAssignedError ? (
              <ErrorState
                message="No se pudieron cargar tus tickets asignados."
                onRetry={() => refetchAssigned()}
              />
            ) : assignedTickets.length > 0 ? (
              <div className="space-y-3">
                {assignedTickets.map((ticket: any) => renderTicketItem(ticket))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No tienes tickets asignados actualmente
              </div>
            )}
          </CardContent>
          {assignedTickets.length > 0 && (
            <CardFooter>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate('/tickets/assigned')}
              >
                Ver todos mis tickets
              </Button>
            </CardFooter>
          )}
        </Card>
        
        {/* Performance Card */}
        <Card>
          <CardHeader>
            <CardTitle>Mi Rendimiento</CardTitle>
            <CardDescription>Resumen de actividad reciente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isStatsError || !ticketStats ? (
              <ErrorState
                message="No se pudo cargar tu resumen de actividad."
                onRetry={() => refetchStats()}
              />
            ) : (
              <>
                <div>
                  <div className="flex justify-between items-center mb-1 text-sm">
                    <span>Carga de trabajo</span>
                    <span className="font-medium">{ticketStats.assigned}/{ticketStats.total} tickets</span>
                  </div>
                  <Progress
                    value={ticketStats.total ? (ticketStats.assigned / ticketStats.total) * 100 : 0}
                    className="h-2"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                    <span>
                      {ticketStats.resolved} tickets resueltos
                    </span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-5 h-5 text-yellow-500 mr-2" />
                    <span>
                      {ticketStats.inProgress} tickets en progreso
                    </span>
                  </div>
                  <div className="flex items-center">
                    <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                    <span>
                      {ticketStats.highPriority} tickets con alta prioridad
                    </span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Pending Tickets */}
        <Card>
          <CardHeader>
            <CardTitle>Tickets Pendientes</CardTitle>
            <CardDescription>Tickets sin asignar</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingPending ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : isPendingError ? (
              <ErrorState
                message="No se pudieron cargar los tickets pendientes."
                onRetry={() => refetchPending()}
              />
            ) : pendingTickets.length > 0 ? (
              <div className="space-y-3">
                {pendingTickets.slice(0, 3).map((ticket: any) => renderTicketItem(ticket, true))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No hay tickets pendientes de asignación
              </div>
            )}
          </CardContent>
          {pendingTickets.length > 3 && (
            <CardFooter>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate('/tickets')}
              >
                Ver más tickets ({pendingTickets.length - 3})
              </Button>
            </CardFooter>
          )}
        </Card>
        
        {/* Recent Activity */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Actividad Reciente</CardTitle>
            <CardDescription>Últimos eventos en el sistema</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingActivity ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : isActivityError ? (
              <ErrorState
                message="No se pudo cargar la actividad reciente."
                onRetry={() => refetchActivity()}
              />
            ) : recentActivity.length === 0 ? (
              <EmptyState message="Todavía no hay actividad en tus tickets." />
            ) : (
              <div className="space-y-4">
                {recentActivity.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                    <div>
                      <p className="text-sm">
                        {item.tickets?.ticket_number && (
                          <span className="font-medium">Ticket #{item.tickets.ticket_number}: </span>
                        )}
                        {item.action}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: es })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
