
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { lazy, Suspense, useState } from "react";
import { Loader2 } from "lucide-react";

// Each page is its own chunk, loaded when its route is first visited.
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const NewTicketPage = lazy(() => import("./pages/NewTicketPage"));
const TicketsPage = lazy(() => import("./pages/TicketsPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const ConfigPage = lazy(() => import("./pages/ConfigPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AssignedTicketsPage = lazy(() => import("./pages/AssignedTicketsPage"));
const SchedulePage = lazy(() => import("./pages/SchedulePage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const UserSettingsPage = lazy(() => import("./pages/UserSettingsPage"));
const Index = lazy(() => import("./pages/Index"));

const PageLoading = () => (
  <div className="min-h-screen flex items-center justify-center" role="status" aria-label="Cargando página">
    <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
  </div>
);

function App() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Suspense fallback={<PageLoading />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="/tickets/new" element={<NewTicketPage />} />
                  <Route path="/tickets" element={<TicketsPage />} />
                  <Route path="/tickets/assigned" element={<AssignedTicketsPage />} />
                  <Route path="/users" element={<UsersPage />} />
                  <Route path="/config" element={<ConfigPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/schedule" element={<SchedulePage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/settings" element={<UserSettingsPage />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
