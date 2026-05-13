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
        <Route path="/empresas" element={<RouteGuard path="/empresas"><EmpresasPage /></RouteGuard>} />
        <Route path="/empresas/:cnpj" element={<RouteGuard path="/empresas"><EmpresaDetailPage /></RouteGuard>} />
        <Route path="/analises" element={<RouteGuard path="/analises"><AnalisesPage /></RouteGuard>} />
        <Route path="/pipeline-de-research" element={<RouteGuard path="/pipeline-de-research"><PipelineResearchPage /></RouteGuard>} />
        <Route path="/configuracoes" element={<RouteGuard path="/configuracoes"><ConfiguracoesPage /></RouteGuard>} />
        <Route path="/assembleias" element={<RouteGuard path="/assembleias"><AssembleiasPage /></RouteGuard>} />
        <Route path="/desempenho" element={<RouteGuard path="/desempenho"><DesempenhoPage /></RouteGuard>} />
        <Route path="/trade" element={<RouteGuard path="/trade"><TradeMonitorPage /></RouteGuard>} />
        <Route path="/trade/upload" element={<RouteGuard path="/trade/upload"><TradeUploadPage /></RouteGuard>} />
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
