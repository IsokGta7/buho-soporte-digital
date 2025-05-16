import React from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/context/AuthContext';
import { Navigate } from 'react-router-dom';
import { AdminTickets } from '@/components/Tickets/AdminTickets';
import { TechnicianTickets } from '@/components/Tickets/TechnicianTickets';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

const TicketsPage: React.FC = () => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  // Move useQuery to top level before any conditionals
  const {
    data: tickets = [],
    isLoading: ticketsLoading,
    error: ticketsError
  } = useQuery({
    queryKey: ['userTickets', user?.id],
    queryFn: async (): Promise<Ticket[]> => {
      let query = supabase
        .from<Ticket>('tickets')
        .select('id, title, status, created_at');

      if (user?.role === 'technician') {
        query = query.eq('assigned_to_id', user.id);
      } else if (user?.role === 'student' || user?.role === 'professor') {
        query = query.eq('creator_id', user.id);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !authLoading && isAuthenticated,
  });

  // 1) Auth-loading spinner
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="animate-spin h-12 w-12 text-gray-200" />
      </div>
    );
  }

  // 2) Redirect if not logged in
  if (!isAuthenticated) {
    return <Navigate to="/auth" />;
  }

  // 3) Decide which component to render
  let Content: React.ReactNode;
  let pageTitle: string;
  switch (user?.role) {
    case 'admin':
      Content = <AdminTickets />;
      pageTitle = 'Gestionar Tickets';
      break;
    case 'technician':
      Content = <TechnicianTickets />;
      pageTitle = 'Tickets Asignados';
      break;
    case 'student':
    case 'professor':
      Content = (
        <div className="space-y-6">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            {pageTitle}
          </h1>
          {ticketsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin h-8 w-8 text-gray-700" />
            </div>
          ) : ticketsError ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded">
              <p className="text-red-800">Error cargando tickets.</p>
            </div>
          ) : tickets.length === 0 ? (
            <p className="text-center text-gray-800">
              No hay tickets que mostrar.
            </p>
          ) : (
            <ul className="space-y-2">
              {tickets.map((t) => (
                <li
                  key={t.id}
                  className="p-4 bg-white border rounded hover:shadow cursor-pointer flex justify-between"
                >
                  <div>
                    <p className="font-medium text-gray-900">{t.title}</p>
                    <p className="text-sm text-gray-700">
                      {new Date(t.created_at).toLocaleDateString('es-MX')}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      t.status === 'nuevo'        ? 'bg-blue-100 text-blue-800' :
                      t.status === 'asignado'     ? 'bg-purple-100 text-purple-800' :
                      t.status === 'en_progreso'  ? 'bg-yellow-100 text-yellow-800' :
                      t.status === 'resuelto'     ? 'bg-green-100 text-green-800' :
                                                     'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {{
                      nuevo: 'Nuevo',
                      asignado: 'Asignado',
                      en_progreso: 'En progreso',
                      resuelto: 'Resuelto',
                      cerrado: 'Cerrado'
                    }[t.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
      pageTitle = 'Mis Tickets';
      break;
    default:
      Content = <div className="text-red-500">Acceso no permitido</div>;
      pageTitle = 'Sin Acceso';
  }

  return (
    <AppLayout>
      <div className="space-y-6 bg-gray-900 p-4 rounded-lg">
        <h1 className="text-3xl font-bold tracking-tight text-gray-100">
          {pageTitle}
        </h1>
        {Content}
      </div>
    </AppLayout>
  );
};

export default TicketsPage;