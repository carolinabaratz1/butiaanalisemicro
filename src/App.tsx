import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AnaliseEmissaoProvider } from "@/contexts/AnaliseEmissaoContext";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import EmpresasPage from "./pages/EmpresasPage";
import EmpresaDetailPage from "./pages/EmpresaDetailPage";
import AnalisesPage from "./pages/AnalisesPage";
import PipelineResearchPage from "./pages/PipelineResearchPage";
import CreditoCorporativoPage from "./pages/CreditoCorporativoPage";
import CreditoEstruturadoPage from "./pages/CreditoEstruturadoPage";
import AcoesPage from "./pages/AcoesPage";
import PosicoesPage from "./pages/PosicoesPage";
import AnalistasPage from "./pages/AnalistasPage";
import ConfiguracoesPage from "./pages/ConfiguracoesPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Carregando...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/posicoes" element={<PosicoesPage />} />
        <Route path="/empresas" element={<EmpresasPage />} />
        <Route path="/empresas/:cnpj" element={<EmpresaDetailPage />} />
        <Route path="/analises" element={<AnalisesPage />} />
        <Route path="/pipeline" element={<PipelinePage />} />
        <Route path="/pipeline-de-research" element={<PipelineResearchPage />} />
        <Route path="/credito/corporativo" element={<CreditoCorporativoPage />} />
        <Route path="/credito/estruturado" element={<CreditoEstruturadoPage />} />
        <Route path="/acoes" element={<AcoesPage />} />
        <Route path="/analistas" element={<AnalistasPage />} />
        <Route path="/configuracoes" element={<ConfiguracoesPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

function AppRoutes() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Carregando...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
    <AnaliseEmissaoProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
    </AnaliseEmissaoProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
