import { Toaster } from "@/components/ui/sonner";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LocaleProvider } from "./contexts/LocaleContext";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import StaticPage from "./pages/StaticPage";
import ToolPage from "./pages/ToolPage";
import AdminPage from "./pages/AdminPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminProcessingPage from "./pages/AdminProcessingPage";
import FirstAdminPage from "./pages/FirstAdminPage";
import CodeStudioPage from "./pages/CodeStudioPage";
import SignPdfPage from "./pages/SignPdfPage";
import FileHashPage from "./pages/FileHashPage";
import { Route, Switch } from "wouter";

function Router() { return <Switch><Route path="/" component={Home}/><Route path="/admin/processing" component={AdminProcessingPage}/><Route path="/admin/users" component={AdminUsersPage}/><Route path="/admin" component={AdminPage}/><Route path="/first-admin" component={FirstAdminPage}/><Route path="/qr-generator" component={CodeStudioPage}/><Route path="/qr-reader" component={CodeStudioPage}/><Route path="/barcode-generator" component={CodeStudioPage}/><Route path="/sign-pdf" component={SignPdfPage}/><Route path="/file-hash" component={FileHashPage}/><Route path="/privacy">{() => <StaticPage page="privacy"/>}</Route><Route path="/terms">{() => <StaticPage page="terms"/>}</Route><Route path="/about">{() => <StaticPage page="about"/>}</Route><Route path="/contact">{() => <StaticPage page="contact"/>}</Route><Route path="/404" component={NotFound}/><Route path="/:toolSlug" component={ToolPage}/><Route component={NotFound}/></Switch>; }
export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="light" switchable><LocaleProvider><Toaster richColors position="top-center"/><Router/></LocaleProvider></ThemeProvider></ErrorBoundary>; }
