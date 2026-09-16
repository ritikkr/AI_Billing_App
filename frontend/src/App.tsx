import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute, RequireCompany } from './components/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import CreateCompany from './pages/CreateCompany';
import Dashboard from './pages/Dashboard';
import CustomersList from './pages/customers/CustomersList';
import CustomerDetail from './pages/customers/CustomerDetail';
import ItemsList from './pages/items/ItemsList';
import InvoicesList from './pages/invoices/InvoicesList';
import InvoiceForm from './pages/invoices/InvoiceForm';
import InvoiceDetail from './pages/invoices/InvoiceDetail';
import CreditNotesList from './pages/creditnotes/CreditNotesList';
import CreditNoteForm from './pages/creditnotes/CreditNoteForm';
import CreditNoteDetail from './pages/creditnotes/CreditNoteDetail';
import QuotationsList from './pages/quotations/QuotationsList';
import QuotationForm from './pages/quotations/QuotationForm';
import QuotationDetail from './pages/quotations/QuotationDetail';
import CertificatesList from './pages/certificates/CertificatesList';
import CertificateForm from './pages/certificates/CertificateForm';
import CertificateDetail from './pages/certificates/CertificateDetail';
import Reports from './pages/reports/Reports';
import CompanySettings from './pages/settings/CompanySettings';
import Profile from './pages/Profile';
import ServeDocument from './pages/serve/ServeDocument';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/companies/new" element={<CreateCompany />} />
        <Route path="/serve/:doc/:id" element={<ServeDocument />} />

        <Route element={<RequireCompany />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/customers" element={<CustomersList />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />
            <Route path="/items" element={<ItemsList />} />
            <Route path="/invoices" element={<InvoicesList />} />
            <Route path="/invoices/new" element={<InvoiceForm />} />
            <Route path="/invoices/:id" element={<InvoiceDetail />} />
            <Route path="/invoices/:id/edit" element={<InvoiceForm />} />
            <Route path="/quotations" element={<QuotationsList />} />
            <Route path="/quotations/new" element={<QuotationForm />} />
            <Route path="/quotations/:id" element={<QuotationDetail />} />
            <Route path="/quotations/:id/edit" element={<QuotationForm />} />
            <Route path="/certificates" element={<CertificatesList />} />
            <Route path="/certificates/new" element={<CertificateForm />} />
            <Route path="/certificates/:id" element={<CertificateDetail />} />
            <Route path="/certificates/:id/edit" element={<CertificateForm />} />
            <Route path="/credit-notes" element={<CreditNotesList />} />
            <Route path="/credit-notes/new" element={<CreditNoteForm />} />
            <Route path="/credit-notes/:id" element={<CreditNoteDetail />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<CompanySettings />} />
            <Route path="/settings/:tab" element={<CompanySettings />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
