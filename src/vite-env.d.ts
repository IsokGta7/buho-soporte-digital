
/// <reference types="vite/client" />

// Define RPC response types for Supabase stored procedures
interface StatusCount {
  status: string;
  count: string; // Postgres returns these as strings
}

interface CategoryCount {
  category: string;
  count: string; // Postgres returns these as strings
}

interface RoleCount {
  role: string;
  count: string; // Postgres returns these as strings
}

interface ServiceStatus {
  wifi_campus: 'operational' | 'degraded' | 'down';
  biblioteca_virtual: 'operational' | 'degraded' | 'down';
  plataforma_lms: 'operational' | 'degraded' | 'down';
  portal_estudiantes: 'operational' | 'degraded' | 'down';
  correo_institucional: 'operational' | 'degraded' | 'down';
}
