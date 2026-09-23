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
import {
  ProductsList,
  ProductsCreate,
  ProductsEdit,
  ProductsShow,
} from "./pages/products";
import {
  CategoriesList,
  CategoriesCreate,
  CategoriesEdit,
  CategoriesShow,
} from "./pages/categories";
import { OrdersList, OrdersShow } from "./pages/orders";
import {
  UsersList,
  UsersAdminsList,
  UsersCustomersList,
  UsersCreate,
  UsersShow,
  UsersEdit,
} from "./pages/users";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ErrorComponent } from "./components/refine-ui/layout/error-component";
import { Layout } from "./components/refine-ui/layout/layout";
import { UnsavedChangesDialog } from "./components/refine-ui/unsaved-changes-dialog";
import { useNotificationProvider } from "./components/refine-ui/notification/use-notification-provider";
import { Toaster } from "./components/refine-ui/notification/toaster";
import { ThemeProvider } from "./components/refine-ui/theme/theme-provider";

import "./App.css";
import { Resources } from "./lib/Resources";

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
                  projectId: "c3q32r-1ar9O2-uUBjky",
                  title: { text: "Store Owner" },
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

                    <Route path="products">
                      <Route index element={<ProductsList />} />
                      <Route path="create" element={<ProductsCreate />} />
                      <Route path="edit/:id" element={<ProductsEdit />} />
                      <Route path="show/:id" element={<ProductsShow />} />
                    </Route>

                    <Route path="categories">
                      <Route index element={<CategoriesList />} />
                      <Route path="create" element={<CategoriesCreate />} />
                      <Route path="edit/:id" element={<CategoriesEdit />} />
                      <Route path="show/:id" element={<CategoriesShow />} />
                    </Route>

                    <Route path="orders">
                      <Route index element={<OrdersList />} />
                      <Route path="show/:id" element={<OrdersShow />} />
                    </Route>

                    <Route path="users">
                      <Route index element={<UsersList />} />
                      <Route path="admins" element={<UsersAdminsList />} />
                      <Route
                        path="customers"
                        element={<UsersCustomersList />}
                      />
                      <Route path="create" element={<UsersCreate />} />
                      <Route path="edit/:id" element={<UsersEdit />} />
                      <Route path="show/:id" element={<UsersShow />} />
                    </Route>

                    <Route path="*" element={<ErrorComponent />} />
                  </Route>
                  <Route
                    element={
                      <Authenticated
                        key="authenticated-outer"
                        fallback={<Outlet />}
                      >
                        <NavigateToResource resource="dashboard" />
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
