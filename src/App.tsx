import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthProvider } from "@/contexts/AuthContext";
import DashboardPage from "./pages/DashboardPage";
import EmpresasPage from "./pages/EmpresasPage";
import AnalisesPage from "./pages/AnalisesPage";
import PipelinePage from "./pages/PipelinePage";
import CreditoCorporativoPage from "./pages/CreditoCorporativoPage";
import CreditoEstruturadoPage from "./pages/CreditoEstruturadoPage";
import AcoesPage from "./pages/AcoesPage";
import PosicoesPage from "./pages/PosicoesPage";
import AnalistasPage from "./pages/AnalistasPage";
import ConfiguracoesPage from "./pages/ConfiguracoesPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/posicoes" element={<PosicoesPage />} />
            <Route path="/empresas" element={<EmpresasPage />} />
            <Route path="/analises" element={<AnalisesPage />} />
            <Route path="/pipeline" element={<PipelinePage />} />
            <Route path="/credito/corporativo" element={<CreditoCorporativoPage />} />
            <Route path="/credito/estruturado" element={<CreditoEstruturadoPage />} />
            <Route path="/acoes" element={<AcoesPage />} />
            <Route path="/analistas" element={<AnalistasPage />} />
            <Route path="/configuracoes" element={<ConfiguracoesPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
