import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wifi, Book, HelpCircle, FileText, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { ErrorState, EmptyState } from '@/components/StateMessage';

const SERVICES: { key: keyof ServiceStatus; label: string }[] = [
  { key: 'wifi_campus', label: 'WiFi Campus' },
  { key: 'biblioteca_virtual', label: 'Biblioteca Virtual' },
  { key: 'plataforma_lms', label: 'Plataforma LMS' },
  { key: 'portal_estudiantes', label: 'Portal Estudiantes' },
  { key: 'correo_institucional', label: 'Correo Institucional' },
];

const serviceBadge = (state: ServiceStatus[keyof ServiceStatus]) => {
  switch (state) {
    case 'operational':
      return { className: 'bg-green-100 text-green-800', label: 'Operativo' };
    case 'degraded':
      return { className: 'bg-yellow-100 text-yellow-800', label: 'Lento' };
    default:
      return { className: 'bg-red-100 text-red-800', label: 'Caído' };
  }
};

interface Anuncio {
  id: string;
  title: string;
  description: string;
  created_at: string;
}

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  
  const fetchStudentTickets = async () => {
    if (!user) return [];
    
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);
      
    if (error) {
      console.error('Error fetching student tickets:', error);
      throw error;
    }
    
    return data || [];
  };
  
  // The latest service status row, or null when none has been published.
  const fetchServiceStatus = async (): Promise<ServiceStatus | null> => {
    const { data, error } = await supabase.rpc('get_service_status');
    if (error) throw error;
    return (data as unknown as ServiceStatus | null) ?? null;
  };

  const { data: tickets = [], isLoading, error, refetch: refetchTickets } = useQuery({
    queryKey: ['studentTickets', user?.id],
    queryFn: fetchStudentTickets,
    enabled: !!user,
  });

  const fetchAnuncios = async (): Promise<Anuncio[]> => {
    const { data, error } = await supabase
      .from('anuncios')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw error;
    return data ?? [];
  };
  const { data: anuncios = [], isLoading: loadingAnuncios, isError: anunciosError, refetch: refetchAnuncios } = useQuery({
    queryKey: ['anuncios'],
    queryFn: fetchAnuncios,
  });

  
  const {
    data: services,
    isLoading: loadingServices,
    isError: servicesError,
    refetch: refetchServices,
  } = useQuery({
    queryKey: ['serviceStatus'],
    queryFn: fetchServiceStatus
  });
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Dashboard de Estudiante</h2>
        <Button className="bg-unison-yellow text-black hover:bg-amber-600" asChild>
          <Link to="/tickets/new">
            <FileText className="mr-2 h-4 w-4" /> Reportar Nueva Incidencia
          </Link>
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Acceso Rápido</CardTitle>
            <CardDescription>Reporta problemas comunes</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button variant="outline" className="justify-start" asChild>
              <Link to="/tickets/new">
                <Wifi className="mr-2 h-4 w-4" /> Problemas de WiFi
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link to="/tickets/new">
                <Book className="mr-2 h-4 w-4" /> Acceso Biblioteca
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link to="/tickets/new">
                <HelpCircle className="mr-2 h-4 w-4" /> Plataforma LMS
              </Link>
            </Button>
          </CardContent>
        </Card>
        
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Mis Incidencias Recientes</CardTitle>
            <CardDescription>Últimas incidencias reportadas</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : error ? (
              <ErrorState
                message="No se pudieron cargar tus incidencias."
                onRetry={() => refetchTickets()}
              />
            ) : tickets.length > 0 ? (
              <div className="space-y-2">
                {tickets.map((ticket: any) => (
                  <Link to="/tickets" key={ticket.id} className="block">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-md hover:bg-gray-100 text-gray-800">
                      <div>
                        <p className="font-medium">{ticket.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(ticket.created_at).toLocaleDateString('es-MX')}
                        </p>
                      </div>
                      <div>
                        <span className={`
                          px-2 py-1 rounded-full text-xs font-medium
                          ${ticket.status === 'nuevo' ? 'bg-blue-100 text-blue-800' : ''}
                          ${ticket.status === 'en_progreso' ? 'bg-yellow-100 text-yellow-800' : ''}
                          ${ticket.status === 'resuelto' ? 'bg-green-100 text-green-800' : ''}
                        `}>
                          {ticket.status === 'nuevo' ? 'Nuevo' : 
                            ticket.status === 'en_progreso' ? 'En Progreso' : 
                            ticket.status === 'asignado' ? 'Asignado' : 
                            ticket.status === 'resuelto' ? 'Resuelto' : 
                            ticket.status === 'cerrado' ? 'Cerrado' : ticket.status}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-center py-4 text-muted-foreground">No has reportado ninguna incidencia</p>
            )}
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ← Replace your old static “Anuncios” div with this: */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Anuncios</CardTitle>
            <CardDescription>Información importante del departamento de TI</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingAnuncios ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : anunciosError ? (
              <ErrorState
                message="No se pudieron cargar los anuncios."
                onRetry={() => refetchAnuncios()}
              />
            ) : anuncios.length > 0 ? (
              <div className="space-y-3">
                {anuncios.map(a => (
                  <div key={a.id} className="p-3 border-l-4 border-blue-500 bg-blue-50 rounded">
                    <p className="font-medium text-gray-900">{a.title}</p>
                    <p className="text-sm text-gray-800">{a.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(a.created_at).toLocaleDateString('es-MX')}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-4 text-muted-foreground">
                No hay anuncios en este momento
              </p>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Estado de Servicios</CardTitle>
            <CardDescription>Estado actual de los servicios universitarios</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingServices ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : servicesError ? (
              <ErrorState
                message="No se pudo cargar el estado de los servicios."
                onRetry={() => refetchServices()}
              />
            ) : !services ? (
              <EmptyState message="Aún no se ha publicado el estado de los servicios." />
            ) : (
              <div className="space-y-2">
                {SERVICES.map(({ key, label }) => {
                  const badge = serviceBadge(services[key]);
                  return (
                    <div key={key} className="flex justify-between items-center">
                      <span>{label}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
