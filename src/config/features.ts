/**
 * Screens and panels that still run on placeholder data, with no table or
 * query behind them yet. They stay in the code but are hidden while their
 * flag is off; turn one on only once it reads real data.
 */
export const FEATURES = {
  /** Configuración > Reglas de SLA, and the SLA compliance figures. */
  slaRules: false,
  /** Configuración > Plantillas de Correo. */
  emailTemplates: false,
  /** Configuración > Parámetros Globales. */
  globalParams: false,
  /** First-response time chart on the admin dashboard. */
  responseTimeChart: false,
  /** Service uptime panel on the admin dashboard. */
  systemHealth: false,
  /** Planned maintenance panels on the admin and professor dashboards. */
  maintenanceSchedule: false,
} as const;
