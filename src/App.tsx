import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import SkusPage from '@/pages/SkusPage'
import SkuDetailPage from '@/pages/SkuDetailPage'
import ComponentsPage from '@/pages/ComponentsPage'
import ProductionPage from '@/pages/ProductionPage'
import InventoryPage from '@/pages/InventoryPage'
import SupplyPage from '@/pages/SupplyPage'
import FinancePage from '@/pages/FinancePage'
import PrintersPage from '@/pages/PrintersPage'
import PrintEconomicsPage from '@/pages/PrintEconomicsPage'
import StrategyPage from '@/pages/StrategyPage'
import BoxTypesPage from '@/pages/BoxTypesPage'
import PrintProfilesPage from '@/pages/PrintProfilesPage'
import PartnersPage from '@/pages/PartnersPage'
import ExpensesPage from '@/pages/ExpensesPage'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route index element={<DashboardPage />} />
                <Route path="skus" element={<SkusPage />} />
                <Route path="skus/:id" element={<SkuDetailPage />} />
                <Route path="components" element={<ComponentsPage />} />
                <Route path="production" element={<ProductionPage />} />
                <Route path="inventory" element={<InventoryPage />} />
                <Route path="supply" element={<SupplyPage />} />
                <Route path="finance" element={<FinancePage />} />
                <Route path="printers" element={<PrintersPage />} />
                <Route path="analytics/print-hour" element={<PrintEconomicsPage />} />
                <Route path="strategy/fbs-to-fbo" element={<StrategyPage />} />
                <Route path="box-types" element={<BoxTypesPage />} />
                <Route path="print-profiles" element={<PrintProfilesPage />} />
                <Route path="partners" element={<PartnersPage />} />
                <Route path="expenses" element={<ExpensesPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
