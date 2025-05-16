
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Projector, BookOpen, FileBarChart, FileText, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';

export const ProfessorDashboard: React.FC = () => {
  const { user } = useAuth();
  
  const fetchProfessorTickets = async () => {
    if (!user) return [];
    
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);
      
    if (error) {
      console.error('Error fetching professor tickets:', error);
      throw error;
    }
    
    return data || [];
  };
  
  const fetchMaintenanceSchedule = async () => {
    // In a real app, this would fetch from a maintenance schedule table
    // For now, we'll return mock data
    return [
      {
        id: '1',
        title: 'Actualización Sistema de Calificaciones',
        date: '2023-06-15',
        timeRange: '22:00 - 02:00',
        status: 'upcoming',
        description: 'El sistema no estará disponible durante este período.'
      },
      {
        id: '2',
        title: 'Mantenimiento Plataforma LMS',
        date: '2023-06-20',
        timeRange: '01:00 - 05:00',
        status: 'upcoming',
        description: 'Se recomienda guardar trabajo pendiente antes de esta fecha.'
      }
    ];
  };
  
  const { data: tickets = [], isLoading, error } = useQuery({
    queryKey: ['professorTickets', user?.id],
    queryFn: fetchProfessorTickets,
    enabled: !!user,
  });
  
  const { data: maintenanceSchedule = [] } = useQuery({
    queryKey: ['maintenanceSchedule'],
    queryFn: fetchMaintenanceSchedule,
  });
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Dashboard de Profesor</h2>
        <Button className="bg-unison-yellow text-black hover:bg-amber-600" asChild>
          <Link to="/tickets/new">
            <FileText className="mr-2 h-4 w-4" /> Reportar Nueva Incidencia
          </Link>
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Herramientas de Enseñanza</CardTitle>
            <CardDescription>Reporta problemas con herramientas</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button variant="outline" className="justify-start" asChild>
              <Link to="/tickets/new">
                <Projector className="mr-2 h-4 w-4" /> Proyector de Aula
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link to="/tickets/new">
                <BookOpen className="mr-2 h-4 w-4" /> Sitio del Curso
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link to="/tickets/new">
                <FileBarChart className="mr-2 h-4 w-4" /> Sistema de Calificaciones
              </Link>
            </Button>
          </CardContent>
        </Card>
        
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Incidencias Docentes</CardTitle>
            <CardDescription>Incidencias recientes y su estado</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : error ? (
              <div className="p-4 border border-red-200 bg-red-50 rounded-md">
                <p className="text-red-600">Error al cargar los tickets</p>
              </div>
            ) : tickets.length > 0 ? (
              <div className="space-y-3">
                {tickets.map((ticket: any) => (
                  <Link to="/tickets" key={ticket.id} className="block">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-md hover:bg-gray-100">
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
                          ${ticket.status === 'asignado' ? 'bg-purple-100 text-purple-800' : ''}
                          ${ticket.status === 'en_progreso' ? 'bg-yellow-100 text-yellow-800' : ''}
                          ${ticket.status === 'resuelto' ? 'bg-green-100 text-green-800' : ''}
                        `}>
                          {ticket.status === 'nuevo' ? 'Nuevo' : 
                            ticket.status === 'asignado' ? 'Asignado' :
                            ticket.status === 'en_progreso' ? 'En Progreso' : 
                            ticket.status === 'resuelto' ? 'Resuelto' : 
                            ticket.status === 'cerrado' ? 'Cerrado' : ticket.status}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-center py-4 text-muted-foreground">No hay incidencias reportadas</p>
            )}
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Mantenimiento Planificado</CardTitle>
            <CardDescription>Calendario de mantenimiento de sistemas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {maintenanceSchedule.map((item: any) => (
                <div key={item.id} className="p-3 border border-gray-200 rounded">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.date} · {item.timeRange}</p>
                    </div>
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {item.status === 'upcoming' ? 'Próximo' : 'Completado'}
                    </span>
                  </div>
                  <p className="mt-2 text-sm">{item.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Recursos para Docentes</CardTitle>
            <CardDescription>Guías y tutoriales disponibles</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <a href="#" className="block p-3 bg-gray-50 hover:bg-gray-100 rounded transition">
                <p className="font-medium text-gray-900">Guía de Uso del Proyector</p>
                <p className="text-sm text-muted-foreground text-gray-900">PDF · 2MB</p>
              </a>
              <a href="#" className="block p-3 bg-gray-50 hover:bg-gray-100 rounded transition">
                <p className="font-medium text-gray-900">Tutorial de Calificaciones</p>
                <p className="text-sm text-muted-foreground text-gray-900">Video · 10min</p>
              </a>
              <a href="#" className="block p-3 bg-gray-50 hover:bg-gray-100 rounded transition">
                <p className="font-medium text-gray-900">Manual de Plataforma LMS</p>
                <p className="text-sm text-muted-foreground text-gray-900">PDF · 5MB</p>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
