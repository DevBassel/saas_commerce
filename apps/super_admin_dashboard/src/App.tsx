import { Refine, Authenticated } from "@refinedev/core";
import { DevtoolsPanel, DevtoolsProvider } from "@refinedev/devtools";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";
import { lazy, Suspense } from "react";
import type { ReactNode } from "react";

import { BrowserRouter, Route, Routes, Outlet } from "react-router";
import routerProvider, {
  NavigateToResource,
  CatchAllNavigate,
  DocumentTitleHandler,
} from "@refinedev/react-router";

import { dataProvider } from "./providers/data";
import { authProvider } from "./providers/auth";
import { Dashboard } from "./pages/dashboard";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ErrorComponent } from "./components/refine-ui/layout/error-component";
import { Layout } from "./components/refine-ui/layout/layout";
import { RouteFallback } from "./components/refine-ui/layout/route-fallback";
import { UnsavedChangesDialog } from "./components/refine-ui/unsaved-changes-dialog";
import { useNotificationProvider } from "./components/refine-ui/notification/use-notification-provider";
import { Toaster } from "./components/refine-ui/notification/toaster";
import { ThemeProvider } from "./components/refine-ui/theme/theme-provider";
import { Resources } from "./lib/Resources";
import "./App.css";

const Login = lazy(() =>
  import("./pages/login").then((module) => ({ default: module.Login })),
);

const TenantsList = lazy(() =>
  import("./pages/tenants/list").then((module) => ({
    default: module.TenantsList,
  })),
);
const TenantsCreate = lazy(() =>
  import("./pages/tenants/create").then((module) => ({
    default: module.TenantsCreate,
  })),
);
const TenantsShow = lazy(() =>
  import("./pages/tenants/show").then((module) => ({
    default: module.TenantsShow,
  })),
);

const PaymentsList = lazy(() =>
  import("./pages/payments/list").then((module) => ({
    default: module.PaymentsList,
  })),
);
const PaymentsShow = lazy(() =>
  import("./pages/payments/show").then((module) => ({
    default: module.PaymentsShow,
  })),
);

const CurrencyRequestsList = lazy(() =>
  import("./pages/currency-requests/list").then((module) => ({
    default: module.CurrencyRequestsList,
  })),
);

const SubscriptionPlansList = lazy(() =>
  import("./pages/subscription-plans/list").then((module) => ({
    default: module.SubscriptionPlansList,
  })),
);
const SubscriptionPlanCreate = lazy(() =>
  import("./pages/subscription-plans/create").then((module) => ({
    default: module.SubscriptionPlanCreate,
  })),
);
const SubscriptionPlanEdit = lazy(() =>
  import("./pages/subscription-plans/edit").then((module) => ({
    default: module.SubscriptionPlanEdit,
  })),
);

// Refine Devtools are a development aid. `import.meta.env.DEV` is inlined as
// `false` for production builds, so this branch (and the `@refinedev/devtools`
// import, which is side-effect free) is tree-shaken out of the shipped bundle.
const Devtools = ({ children }: { children: ReactNode }) => {
  if (!import.meta.env.DEV) return <>{children}</>;
  return (
    <DevtoolsProvider>
      {children}
      <DevtoolsPanel />
    </DevtoolsProvider>
  );
};

const routerBasename =
  import.meta.env.BASE_URL === "/"
    ? "/"
    : import.meta.env.BASE_URL.replace(/\/$/, "");

function App() {
  return (
    <BrowserRouter basename={routerBasename}>
      <ErrorBoundary>
        <RefineKbarProvider>
          <ThemeProvider>
            <Devtools>
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
                          <Suspense fallback={<RouteFallback />}>
                            <Outlet />
                          </Suspense>
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

                    <Route path="payments">
                      <Route index element={<PaymentsList />} />
                      <Route path="show/:id" element={<PaymentsShow />} />
                    </Route>

                    <Route path="currency-requests">
                      <Route index element={<CurrencyRequestsList />} />
                    </Route>

                    <Route path="subscription-plans">
                      <Route index element={<SubscriptionPlansList />} />
                      <Route path="create" element={<SubscriptionPlanCreate />} />
                      <Route path="edit/:id" element={<SubscriptionPlanEdit />} />
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
                    <Route
                      path="/login"
                      element={
                        <Suspense fallback={<RouteFallback fullScreen />}>
                          <Login />
                        </Suspense>
                      }
                    />
                  </Route>
                </Routes>

                <Toaster />
                <RefineKbar />
                <UnsavedChangesDialog />
                <DocumentTitleHandler />
              </Refine>
            </Devtools>
          </ThemeProvider>
        </RefineKbarProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
