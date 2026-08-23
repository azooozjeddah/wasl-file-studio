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
import CodeStudioPage from "./pages/CodeStudioPage";
import SignPdfPage from "./pages/SignPdfPage";
import FileHashPage from "./pages/FileHashPage";
import LoginPage from "./pages/LoginPage";
import ContactPage from "./pages/ContactPage";
import AccountSecurityPage from "./pages/AccountSecurityPage";
import UserDashboardPage from "./pages/UserDashboardPage";
import PowerPointStudioPage from "./pages/PowerPointStudioPage";
import { useAuth } from "./_core/hooks/useAuth";
import { findTool } from "./lib/tools";
import { rememberRecentTool } from "./lib/user-recent-tools";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { Route, Switch } from "wouter";

function Router() { return <Switch><Route path="/" component={Home}/><Route path="/dashboard" component={UserDashboardPage}/><Route path="/login" component={LoginPage}/><Route path="/register" component={LoginPage}/><Route path="/account/security" component={AccountSecurityPage}/><Route path="/admin/processing" component={AdminProcessingPage}/><Route path="/admin/users" component={AdminUsersPage}/><Route path="/admin" component={AdminPage}/><Route path="/first-admin" component={LoginPage}/><Route path="/qr-generator" component={CodeStudioPage}/><Route path="/qr-reader" component={CodeStudioPage}/><Route path="/pptx-to-pdf" component={PowerPointStudioPage}/><Route path="/sign-pdf" component={SignPdfPage}/><Route path="/file-hash" component={FileHashPage}/><Route path="/privacy">{() => <StaticPage page="privacy"/>}</Route><Route path="/terms">{() => <StaticPage page="terms"/>}</Route><Route path="/about">{() => <StaticPage page="about"/>}</Route><Route path="/contact" component={ContactPage}/><Route path="/404" component={NotFound}/><Route path="/:toolSlug" component={ToolPage}/><Route component={NotFound}/></Switch>; }
function SessionToolTracker() { const [location] = useLocation(); const { user } = useAuth(); useEffect(() => { const tool = findTool(location.slice(1)); if (tool && user) rememberRecentTool(user.id, tool.slug); }, [location, user]); return null; }
export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="light" switchable><LocaleProvider><Toaster richColors position="top-center"/><SessionToolTracker/><Router/></LocaleProvider></ThemeProvider></ErrorBoundary>; }
