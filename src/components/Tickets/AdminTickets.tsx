import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
}
interface Ticket { id: string; ticket_number: string; title: string; assigned_to_id: string | null; }

export const AdminTickets: React.FC = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  // 1) Fetch all tickets
  const { data: tickets = [] } = useQuery<Ticket[]>({
    queryKey: ['adminTickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from<Ticket>('tickets')
        .select('id, ticket_number, title, assigned_to_id');
      if (error) throw error;
      return data;
    }
  });

  // 2) Fixed technicians query
  const { data: techs = [] } = useQuery<Profile[]>({
    queryKey: ['technicians'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from<Profile>('profiles')
        .select('id, first_name, last_name')
        .ilike('role', 'technician'); // Changed to ilike for case-insensitive match

      return data || [];
    },
    enabled: user?.role === 'admin',
  });

  // 3) Mutation remains the same
  const reassignMutation = useMutation({
    mutationFn: async ({ ticketId, techId }: { ticketId: string; techId: string }) => {
      const { error } = await supabase
        .from('tickets')
        .update({ 
          assigned_to_id: techId, 
          status: 'asignado', // Add status update
          updated_at: new Date().toISOString() 
        })
        .eq('id', ticketId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Ticket reasignado correctamente');
      qc.invalidateQueries(['adminTickets']);
    },
    onError: () => toast.error('Error al reasignar ticket')
  });

   return (
    <Table>
      {/* Table header remains the same */}
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Título</TableHead>
          <TableHead>Asignado a</TableHead>
          <TableHead>Acciones</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {tickets.map((ticket) => (
          <TableRow key={ticket.id}>
            {/* Ticket cells remain the same */}
            <TableCell>{ticket.ticket_number}</TableCell>
            <TableCell>{ticket.title}</TableCell>
            <TableCell>
              {techs.find(t => t.id === ticket.assigned_to_id)?.first_name || 'Sin asignar'}
            </TableCell>

            {/* Fixed Dropdown Menu */}
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Acciones</span>
                  </Button>
                </DropdownMenuTrigger>
                
                <DropdownMenuContent 
                  align="end"
                  className="max-h-60 overflow-y-auto" // ← Added scroll for many technicians
                  sideOffset={8}
                >
                  <DropdownMenuLabel className="px-4 py-2 text-sm font-semibold">
                    Reasignar a:
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  
                  {techs.length === 0 ? (
                    <div className="px-4 py-2 text-sm text-gray-500">
                      No hay técnicos disponibles
                    </div>
                  ) : (
                    techs.map((tech) => (
                      <DropdownMenuItem
                        key={tech.id}
                        onSelect={() => reassignMutation.mutate({
                          ticketId: ticket.id,
                          techId: tech.id
                        })}
                        className="px-4 py-2 text-sm" // ← Ensure proper spacing
                      >
                        {tech.first_name} {tech.last_name}
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};