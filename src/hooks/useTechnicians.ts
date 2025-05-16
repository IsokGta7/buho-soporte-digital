// src/hooks/useTechnicians.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client';

interface Technician {
  id: string
  first_name: string
  last_name: string
}

export default function useTechnicians() {
  // Get the logged-in user and check if they have the 'admin' role
  const user = supabase.auth.user()
  const isAdmin = user?.app_metadata?.role === 'admin'

  return useQuery<Technician[], Error>({
    queryKey: ['technicians'],
    // The query function: fetch technician profiles from Supabase
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('role', 'technician')
      if (error) throw error
      return data || []
    },
    enabled: !!isAdmin,  // only run this query if user is admin
  })
}
