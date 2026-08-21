import { Toaster } from "@/components/ui/sonner";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LocaleProvider } from "./contexts/LocaleContext";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import StaticPage from "./pages/StaticPage";
import ToolPage from "./pages/ToolPage";
import AdminPage from "./pages/AdminPage";
import FirstAdminPage from "./pages/FirstAdminPage";
import { Route, Switch } from "wouter";

function Router() { return <Switch><Route path="/" component={Home}/><Route path="/admin" component={AdminPage}/><Route path="/first-admin" component={FirstAdminPage}/><Route path="/privacy">{() => <StaticPage page="privacy"/>}</Route><Route path="/terms">{() => <StaticPage page="terms"/>}</Route><Route path="/about">{() => <StaticPage page="about"/>}</Route><Route path="/contact">{() => <StaticPage page="contact"/>}</Route><Route path="/404" component={NotFound}/><Route path="/:toolSlug" component={ToolPage}/><Route component={NotFound}/></Switch>; }
export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="light" switchable><LocaleProvider><Toaster richColors position="top-center"/><Router/></LocaleProvider></ThemeProvider></ErrorBoundary>; }
