import { Refine, Authenticated } from "@refinedev/core";
import { DevtoolsPanel, DevtoolsProvider } from "@refinedev/devtools";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";

import { BrowserRouter, Route, Routes, Outlet } from "react-router";
import routerProvider, {
  NavigateToResource,
  CatchAllNavigate,
  DocumentTitleHandler,
} from "@refinedev/react-router";

import { dataProvider } from "./providers/data";
import { authProvider } from "./providers/auth";
import { Login } from "./pages/login";
import { Dashboard } from "./pages/dashboard";
import { TenantsList, TenantsCreate, TenantsShow } from "./pages/tenants";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ErrorComponent } from "./components/refine-ui/layout/error-component";
import { Layout } from "./components/refine-ui/layout/layout";
import { UnsavedChangesDialog } from "./components/refine-ui/unsaved-changes-dialog";
import { useNotificationProvider } from "./components/refine-ui/notification/use-notification-provider";
import { Toaster } from "./components/refine-ui/notification/toaster";
import { ThemeProvider } from "./components/refine-ui/theme/theme-provider";
import { Resources } from "./lib/Resources";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <RefineKbarProvider>
          <ThemeProvider>
            <DevtoolsProvider>
              <Refine
                dataProvider={dataProvider}
                notificationProvider={useNotificationProvider()}
                routerProvider={routerProvider}
                authProvider={authProvider}
                resources={Resources}
                options={{
                  syncWithLocation: true,
                  warnWhenUnsavedChanges: true,
                  projectId: "wkZzoq-1FsqsT-VvuYfB",
                  title: { text: "Super Admin" },
                }}
              >
                <Routes>
                  <Route
                    element={
                      <Authenticated
                        key="authenticated-inner"
                        fallback={<CatchAllNavigate to="/login" />}
                      >
                        <Layout>
                          <Outlet />
                        </Layout>
                      </Authenticated>
                    }
                  >
                    <Route index element={<Dashboard />} />

                    <Route path="tenants">
                      <Route index element={<TenantsList />} />
                      <Route path="create" element={<TenantsCreate />} />
                      <Route path="show/:id" element={<TenantsShow />} />
                    </Route>

                    <Route path="*" element={<ErrorComponent />} />
                  </Route>
                  <Route
                    element={
                      <Authenticated
                        key="authenticated-outer"
                        fallback={<Outlet />}
                      >
                        <NavigateToResource resource="platform/tenants" />
                      </Authenticated>
                    }
                  >
                    <Route path="/login" element={<Login />} />
                  </Route>
                </Routes>

                <Toaster />
                <RefineKbar />
                <UnsavedChangesDialog />
                <DocumentTitleHandler />
              </Refine>
              <DevtoolsPanel />
            </DevtoolsProvider>
          </ThemeProvider>
        </RefineKbarProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
