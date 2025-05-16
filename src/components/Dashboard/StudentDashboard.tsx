import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wifi, Book, HelpCircle, FileText, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';

// Define a type for the service status response from RPC
interface ServiceStatusResponse {
  [key: string]: string; // Generic response object with string values
}

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
  
  const fetchServiceStatus = async (): Promise<ServiceStatus> => {
    // Try to fetch from a service status table if it exists
    try {
      // Use the RPC function to get service status
      const { data, error } = await supabase
        .rpc('get_service_status') as { data: ServiceStatusResponse | null; error: any };
      
      if (error) {
        console.error('Error fetching service status:', error);
        throw error;
      }
      
      // If we got data, return it as ServiceStatus
      if (data) {
        return {
          wifi_campus: data.wifi_campus as 'operational' | 'degraded' | 'down',
          biblioteca_virtual: data.biblioteca_virtual as 'operational' | 'degraded' | 'down',
          plataforma_lms: data.plataforma_lms as 'operational' | 'degraded' | 'down',
          portal_estudiantes: data.portal_estudiantes as 'operational' | 'degraded' | 'down',
          correo_institucional: data.correo_institucional as 'operational' | 'degraded' | 'down'
        };
      }
      
      throw new Error('No service status data returned');
    } catch (error) {
      console.error('Error in fetchServiceStatus:', error);
      // If there's an error (like table doesn't exist), return mock data
      return {
        wifi_campus: 'operational',
        biblioteca_virtual: 'operational',
        plataforma_lms: 'degraded',
        portal_estudiantes: 'operational',
        correo_institucional: 'operational'
      };
    }
  };
  
  const { data: tickets = [], isLoading, error } = useQuery({
    queryKey: ['studentTickets', user?.id],
    queryFn: fetchStudentTickets,
    enabled: !!user,
  });

  interface Anuncio { id: string; title: string; description: string; created_at: string }
  const fetchAnuncios = async (): Promise<Anuncio[]> => {
    const { data, error } = await supabase
      .from<Anuncio>('anuncios')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw error;
    return data ?? [];
  };
    const { data: anuncios = [], isLoading: loadingAnuncios } = useQuery({
  queryKey: ['anuncios'],
  queryFn: fetchAnuncios,
});

  
  const { data: services = {
    wifi_campus: 'operational',
    biblioteca_virtual: 'operational',
    plataforma_lms: 'degraded',
    portal_estudiantes: 'operational',
    correo_institucional: 'operational'
  } as ServiceStatus } = useQuery({
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
              <div className="p-4 border border-red-200 bg-red-50 rounded-md">
                <p className="text-red-600">Error al cargar los tickets</p>
              </div>
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
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span>WiFi Campus</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  services.wifi_campus === 'operational' ? 'bg-green-100 text-green-800' : 
                  services.wifi_campus === 'degraded' ? 'bg-yellow-100 text-yellow-800' : 
                  'bg-red-100 text-red-800'
                }`}>
                  {services.wifi_campus === 'operational' ? 'Operativo' : 
                   services.wifi_campus === 'degraded' ? 'Lento' : 'Caído'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Biblioteca Virtual</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  services.biblioteca_virtual === 'operational' ? 'bg-green-100 text-green-800' : 
                  services.biblioteca_virtual === 'degraded' ? 'bg-yellow-100 text-yellow-800' : 
                  'bg-red-100 text-red-800'
                }`}>
                  {services.biblioteca_virtual === 'operational' ? 'Operativo' : 
                   services.biblioteca_virtual === 'degraded' ? 'Lento' : 'Caído'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Plataforma LMS</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  services.plataforma_lms === 'operational' ? 'bg-green-100 text-green-800' : 
                  services.plataforma_lms === 'degraded' ? 'bg-yellow-100 text-yellow-800' : 
                  'bg-red-100 text-red-800'
                }`}>
                  {services.plataforma_lms === 'operational' ? 'Operativo' : 
                   services.plataforma_lms === 'degraded' ? 'Lento' : 'Caído'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Portal Estudiantes</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  services.portal_estudiantes === 'operational' ? 'bg-green-100 text-green-800' : 
                  services.portal_estudiantes === 'degraded' ? 'bg-yellow-100 text-yellow-800' : 
                  'bg-red-100 text-red-800'
                }`}>
                  {services.portal_estudiantes === 'operational' ? 'Operativo' : 
                   services.portal_estudiantes === 'degraded' ? 'Lento' : 'Caído'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Correo Institucional</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  services.correo_institucional === 'operational' ? 'bg-green-100 text-green-800' : 
                  services.correo_institucional === 'degraded' ? 'bg-yellow-100 text-yellow-800' : 
                  'bg-red-100 text-red-800'
                }`}>
                  {services.correo_institucional === 'operational' ? 'Operativo' : 
                   services.correo_institucional === 'degraded' ? 'Lento' : 'Caído'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
