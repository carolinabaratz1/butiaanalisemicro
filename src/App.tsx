import type React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AnaliseEmissaoProvider } from "@/contexts/AnaliseEmissaoContext";
import { ButiaLogo } from "@/components/ui/ButiaLogo";
import { useTheme } from "@/hooks/useTheme";
import LoginPage from "./pages/LoginPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import MfaEnrollPage from "./pages/MfaEnrollPage";
import MfaVerifyPage from "./pages/MfaVerifyPage";
import DashboardPage from "./pages/DashboardPage";
import EmpresasPage from "./pages/EmpresasPage";
import EmpresaDetailPage from "./pages/EmpresaDetailPage";
import AnalisesPage from "./pages/AnalisesPage";
import PipelineResearchPage from "./pages/PipelineResearchPage";
import PosicoesPage from "./pages/PosicoesPage";
import ConfiguracoesPage from "./pages/ConfiguracoesPage";
import AssembleiasPage from "./pages/AssembleiasPage";
import DesempenhoPage from "./pages/DesempenhoPage";
import { TradeMonitorPage } from "./components/trade/TradeMonitorPage";
import { UploadPage as TradeUploadPage } from "./components/trade/UploadPage";
import FidcMonitorPage from "./pages/fidc/MonitorPage";
import FidcDashboardCarteirasPage from "./pages/fidc/DashboardCarteirasPage";
import FidcListPage from "./pages/fidc/FidcListPage";
import FidcDetailPage from "./pages/fidc/FidcDetailPage";
import FidcCadastroPage from "./pages/fidc/FidcCadastroPage";
import FidcPareceresPage from "./pages/fidc/PareceresPage";
import FidcAlertasPage from "./pages/fidc/AlertasPage";
import { FidcLayout } from "./components/fidc/FidcSubNav";
import RatingResolverPage from "./pages/RatingResolverPage";
import PositionsMonitorPage from "./pages/PositionsMonitorPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

function LoadingScreen() {
  const { theme } = useTheme();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <ButiaLogo variant="full" theme={theme === "dark" ? "dark" : "light"} size="lg" />
      <p className="text-sm text-muted-foreground">Carregando plataforma...</p>
    </div>
  );
}

function ProtectedRoutes() {
  const { session, loading, currentUser, mfaStatus } = useAuth();

  if (loading || mfaStatus === 'loading') {
    return <LoadingScreen />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Aguarda o profile carregar antes de aplicar RouteGuard,
  // senão sections=[] redireciona qualquer rota para "/" durante a corrida.
  if (!currentUser) {
    return <LoadingScreen />;
  }

  if (currentUser?.must_change_password) {
    return <Navigate to="/trocar-senha" replace />;
  }

  if (mfaStatus === 'needs_enroll') {
    return <Navigate to="/mfa/configurar" replace />;
  }

  if (mfaStatus === 'needs_verify') {
    return <Navigate to="/mfa/verificar" replace />;
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/posicoes" element={<RouteGuard path="/posicoes"><PosicoesPage /></RouteGuard>} />
        {/* Nova seção consolidada: Emissores (antigas Empresas + Análises) */}
        <Route path="/emissores" element={<RouteGuard path="/emissores"><EmpresasPage /></RouteGuard>} />
        <Route path="/emissores/:cnpj" element={<RouteGuard path="/emissores"><EmpresaDetailPage /></RouteGuard>} />
        <Route path="/ratings/resolver" element={<RouteGuard path="/emissores"><RatingResolverPage /></RouteGuard>} />
        {/* Redirects legados — preservam links antigos */}
        <Route path="/empresas" element={<Navigate to="/emissores" replace />} />
        <Route path="/empresas/:cnpj" element={<LegacyEmpresaRedirect />} />
        <Route path="/analises" element={<RouteGuard path="/emissores"><AnalisesPage /></RouteGuard>} />
        <Route path="/pipeline-de-research" element={<RouteGuard path="/pipeline-de-research"><PipelineResearchPage /></RouteGuard>} />
        <Route path="/configuracoes" element={<RouteGuard path="/configuracoes"><ConfiguracoesPage /></RouteGuard>} />
        <Route path="/assembleias" element={<RouteGuard path="/assembleias"><AssembleiasPage /></RouteGuard>} />
        <Route path="/desempenho" element={<RouteGuard path="/desempenho"><DesempenhoPage /></RouteGuard>} />
        <Route path="/trade" element={<RouteGuard path="/trade"><TradeMonitorPage /></RouteGuard>} />
        <Route path="/trade/upload" element={<RouteGuard path="/trade/upload"><TradeUploadPage /></RouteGuard>} />
        <Route path="/fidc-monitor" element={<RouteGuard path="/fidc-monitor"><FidcLayout><FidcDashboardCarteirasPage /></FidcLayout></RouteGuard>} />
        <Route path="/fidc-monitor/monitor" element={<RouteGuard path="/fidc-monitor"><FidcLayout><FidcMonitorPage /></FidcLayout></RouteGuard>} />
        <Route path="/fidc-monitor/fidcs" element={<RouteGuard path="/fidc-monitor/fidcs"><FidcLayout><FidcListPage /></FidcLayout></RouteGuard>} />
        <Route path="/fidc-monitor/fidcs/:id" element={<RouteGuard path="/fidc-monitor/fidcs"><FidcLayout><FidcDetailPage /></FidcLayout></RouteGuard>} />
        <Route path="/fidc-monitor/cadastro" element={<RouteGuard path="/fidc-monitor/cadastro"><FidcLayout><FidcCadastroPage /></FidcLayout></RouteGuard>} />
        <Route path="/fidc-monitor/pareceres" element={<RouteGuard path="/fidc-monitor/pareceres"><FidcLayout><FidcPareceresPage /></FidcLayout></RouteGuard>} />
        <Route path="/fidc-monitor/alertas" element={<RouteGuard path="/fidc-monitor/alertas"><FidcLayout><FidcAlertasPage /></FidcLayout></RouteGuard>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

function RouteGuard({ path, children }: { path: string; children: React.ReactNode }) {
  const { hasAccess } = useAuth();
  if (!hasAccess(path)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function LegacyEmpresaRedirect() {
  // /empresas/:cnpj → /emissores/:cnpj
  const path = window.location.pathname.replace(/^\/empresas\//, '/emissores/');
  return <Navigate to={path} replace />;
}

function AppRoutes() {
  const { session, loading, currentUser, mfaStatus } = useAuth();

  if (loading || mfaStatus === 'loading') {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/trocar-senha" element={
        !session ? <Navigate to="/login" replace /> :
        !currentUser?.must_change_password ? <Navigate to="/" replace /> :
        <ChangePasswordPage />
      } />
      <Route path="/mfa/configurar" element={
        !session ? <Navigate to="/login" replace /> :
        mfaStatus !== 'needs_enroll' ? <Navigate to="/" replace /> :
        <MfaEnrollPage />
      } />
      <Route path="/mfa/verificar" element={
        !session ? <Navigate to="/login" replace /> :
        mfaStatus !== 'needs_verify' ? <Navigate to="/" replace /> :
        <MfaVerifyPage />
      } />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  );
}

function ThemeInit() {
  useTheme();
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
    <AnaliseEmissaoProvider>
    <TooltipProvider>
      <ThemeInit />
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
