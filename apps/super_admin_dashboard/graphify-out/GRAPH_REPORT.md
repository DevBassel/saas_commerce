# Graph Report - super_admin_dashboard  (2026-11-20)

## Corpus Check
- Corpus is ~38,136 words - fits in a single context window. You may not need a graph.

## Summary
- 1029 nodes · 3323 edges · 66 communities (39 shown, 27 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: unavailable for host-agent semantic extraction (tracker recorded 0 input · 0 output)

## Community Hubs (Navigation)
- Refine CRUD Views
- Subscription Plans and Usage
- Dashboard and Tenant Details
- Payment Operations and History
- Filtering Dialog Components
- Advanced Interaction Components
- Form Schemas and Fields
- Core Runtime Dependencies
- Administrative Data Tables
- Header Theme Controls
- Responsive Sidebar Components
- Development Toolchain Dependencies
- Application Package Metadata
- Dashboard Layout Navigation
- Application Routes and Resources
- Application TypeScript Configuration
- Shadcn Component Configuration
- Node TypeScript Configuration
- Tenant Data Provider
- Platform Architecture Contracts
- Toggle Control Components
- API Client Configuration
- Sidebar Sheet Components
- Project Documentation Links
- Authentication Session Flow
- User Identity Display
- Chart Visualization Components
- Drawer Overlay Components
- Navigation Menu Components
- Application Bootstrap Strategy
- Vite Build Configuration
- Pagination Controls
- Turborepo Build Configuration
- React Error Boundary
- Toast Notification System
- Package Command Scripts
- Embedded Build Delivery
- Alert Message Components
- Super Admin Platform Overview
- Aspect Ratio Component
- Hover Card Components
- Browser Target Configuration
- React Root Mounting
- Dayjs Date Library
- Embla Carousel Library
- OTP Input Library
- Radix Alert Dialog
- Radix Dialog Primitive
- Radix Hover Card
- Radix Label Primitive
- Radix Menubar Primitive
- Radix Progress Primitive
- Radix Scroll Area
- Radix Slider Primitive
- Radix Slot Primitive
- Radix Tabs Primitive
- Calendar Picker Library
- Resizable Panels Library
- Recharts Visualization Library
- Refine Command Palette
- Refine REST Adapter
- Shadcn CLI Dependency
- Tailwind Class Merging
- Drawer Primitive Library
- Schema Validation Library

## God Nodes (most connected - your core abstractions)
1. `cn()` - 348 edges
2. `react` - 85 edges
3. `Button()` - 75 edges
4. `lucide-react` - 56 edges
5. `@refinedev/core` - 45 edges
6. `Separator()` - 42 edges
7. `Card()` - 41 edges
8. `CardContent()` - 41 edges
9. `CardHeader()` - 40 edges
10. `CardTitle()` - 40 edges

## Surprising Connections (you probably didn't know these)
- `Login()` --calls--> `SignInForm()`  [EXTRACTED]
  src/pages/login/index.tsx → src/components/refine-ui/form/sign-in-form.tsx
- `AlertTitle()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/alert.tsx → src/lib/utils.ts
- `AlertDescription()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/alert.tsx → src/lib/utils.ts
- `BreadcrumbLink()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/breadcrumb.tsx → src/lib/utils.ts
- `BreadcrumbEllipsis()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/breadcrumb.tsx → src/lib/utils.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Platform Authentication Session Flow** — apps_super_admin_dashboard_agents_platform_auth_provider, apps_super_admin_dashboard_agents_administrative_session_token_storage, apps_super_admin_dashboard_agents_single_flight_token_refresh, apps_super_admin_dashboard_agents_api_client [EXTRACTED 1.00]
- **Embedded Dashboard Delivery Model** — apps_super_admin_dashboard_agents_embedded_production_build, apps_super_admin_dashboard_agents_api_static_hosting, apps_super_admin_dashboard_agents_base_path_strategy, apps_super_admin_dashboard_agents_manual_chunk_strategy [EXTRACTED 1.00]

## Communities (66 total, 27 thin omitted)

### Community 0 - "Refine CRUD Views"
Cohesion: 0.06
Nodes (66): @hookform/resolvers, lucide-react, react, @refinedev/core, ApiError, CloneButton, CloneButtonProps, CreateButton (+58 more)

### Community 1 - "Subscription Plans and Usage"
Cohesion: 0.05
Nodes (63): react-router, @tanstack/react-table, SUBSCRIPTION_PLANS_RESOURCE, subscriptionsApi, STATUS_VARIANT, DataTablePagination(), DataTablePaginationProps, DataTableSorter() (+55 more)

### Community 2 - "Dashboard and Tenant Details"
Cohesion: 0.14
Nodes (42): date-fns, BalanceValue(), StatusRow(), ForgotPasswordForm(), SignUpForm(), DetailRow(), ShowView(), SubscriptionStatusBadge() (+34 more)

### Community 3 - "Payment Operations and History"
Cohesion: 0.09
Nodes (54): toApiError(), CURRENCY_REQUESTS_RESOURCE, currencyRequestsApi, PAYMENTS_RESOURCE, paymentsApi, CurrencyRequestActions(), PlanRowActions(), Accordion() (+46 more)

### Community 4 - "Filtering Dialog Components"
Cohesion: 0.09
Nodes (48): healthApi, HealthResponse, DeleteButton, DeleteButtonProps, CRUD_OPERATOR_LABELS, DataTableFilterCombobox(), DataTableFilterComboboxProps, DataTableFilterDropdown() (+40 more)

### Community 5 - "Advanced Interaction Components"
Cohesion: 0.06
Nodes (36): LoadingOverlay, LoadingOverlayProps, CardAction(), Checkbox(), ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel() (+28 more)

### Community 6 - "Form Schemas and Fields"
Cohesion: 0.15
Nodes (33): react-hook-form, SignInFormValues, signInSchema, InputPassword(), InputPasswordProps, SignInForm(), PlanBasicFields(), PlanFeaturesFields() (+25 more)

### Community 7 - "Core Runtime Dependencies"
Cohesion: 0.05
Nodes (39): dependencies, clsx@^2.1.1, date-fns@^4.1.0, @hookform/resolvers@^5.0.1, lucide-react@^0.487.0, next-themes@^0.4.6, postcss@^8.5.3, @radix-ui/react-accordion@^1.2.8 (+31 more)

### Community 8 - "Administrative Data Tables"
Cohesion: 0.13
Nodes (28): @refinedev/react-table@^6.0.0, @refinedev/react-table, currencyRequestColumns, paymentColumns, DataTable(), DataTableNoData(), DataTableProps, getCommonStyles() (+20 more)

### Community 9 - "Header Theme Controls"
Cohesion: 0.11
Nodes (24): DesktopHeader(), UserDropdown(), initialState, Theme, ThemeProviderContext, ThemeProviderProps, ThemeProviderState, useTheme() (+16 more)

### Community 10 - "Responsive Sidebar Components"
Cohesion: 0.10
Nodes (27): ErrorComponent(), SidebarContent(), SidebarFooter(), SidebarGroup(), SidebarGroupAction(), SidebarGroupContent(), SidebarGroupLabel(), SidebarHeader() (+19 more)

### Community 11 - "Development Toolchain Dependencies"
Cohesion: 0.08
Nodes (29): devDependencies, eslint@^9.25.0, @eslint/js@^9.25.0, eslint-plugin-react-hooks@^5.2.0, eslint-plugin-react-refresh@^0.4.19, globals@^16.0.0, tailwindcss@^4.1.4, @tailwindcss/postcss@^4.1.4 (+21 more)

### Community 12 - "Application Package Metadata"
Cohesion: 0.07
Nodes (28): axios@^1.20.0, cmdk@^1.1.1, jwt-decode@^4.0.0, @radix-ui/react-collapsible@^1.1.8, @radix-ui/react-dropdown-menu@^2.1.12, @radix-ui/react-navigation-menu@^1.2.10, @radix-ui/react-radio-group@^1.3.4, @radix-ui/react-switch@^1.2.2 (+20 more)

### Community 13 - "Dashboard Layout Navigation"
Cohesion: 0.16
Nodes (25): Header(), MobileHeader(), Layout(), getDisplayName(), IconProps, ItemIcon(), MenuItemProps, Sidebar() (+17 more)

### Community 14 - "Application Routes and Resources"
Cohesion: 0.16
Nodes (17): App(), CurrencyRequestsList, Devtools(), Login, PaymentsList, PaymentsShow, SubscriptionPlanCreate, SubscriptionPlanEdit (+9 more)

### Community 15 - "Application TypeScript Configuration"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, baseUrl, jsx, lib, module, moduleDetection, moduleResolution (+12 more)

### Community 16 - "Shadcn Component Configuration"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 17 - "Node TypeScript Configuration"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, lib, module, moduleDetection, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 18 - "Tenant Data Provider"
Cohesion: 0.21
Nodes (10): apiClient, applyFilters(), applyPagination(), applySorters(), REGISTER_STORE_RESOURCE, RegisterStorePayload, RegisterStoreResponse, TENANTS_RESOURCE (+2 more)

### Community 19 - "Platform Architecture Contracts"
Cohesion: 0.15
Nodes (12): Administrative Session Token Storage, API Client, API Error Normalization, Build-Time Environment Contract, Client-Side Query Processing, Custom Data Provider, Identity Shape Mismatch, Platform API Surface (+4 more)

### Community 20 - "Toggle Control Components"
Cohesion: 0.21
Nodes (11): class-variance-authority@^0.7.1, @radix-ui/react-toggle@^1.1.6, @radix-ui/react-toggle-group@^1.1.7, class-variance-authority, @radix-ui/react-toggle, @radix-ui/react-toggle-group, ToggleGroup(), ToggleGroupContext (+3 more)

### Community 21 - "API Client Configuration"
Cohesion: 0.23
Nodes (7): AUTH_ENDPOINTS, extractMessage(), RetriableRequestConfig, API_URL, REFRESH_TOKEN_KEY, TOKEN_KEY, USER_EMAIL_KEY

### Community 22 - "Sidebar Sheet Components"
Cohesion: 0.26
Nodes (9): Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetPortal(), SheetTitle() (+1 more)

### Community 23 - "Project Documentation Links"
Cohesion: 0.18
Nodes (11): create-refine-app, Custom Auth Provider Documentation, Internal Tools Framework Capabilities, MIT License, Package Scripts, React Router Documentation, Refine Documentation, Refine Framework (+3 more)

### Community 24 - "Authentication Session Flow"
Cohesion: 0.22
Nodes (9): authApi, PlatformLoginPayload, TokenPair, refreshSession(), tokenStorage, authProvider, decodeJwt(), isTokenValid() (+1 more)

### Community 25 - "User Identity Display"
Cohesion: 0.35
Nodes (8): getInitials(), User, UserAvatar(), User, UserInfo(), Avatar(), AvatarFallback(), AvatarImage()

### Community 26 - "Chart Visualization Components"
Cohesion: 0.27
Nodes (10): ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartStyle(), ChartTooltipContent(), getPayloadConfigFromPayload() (+2 more)

### Community 27 - "Drawer Overlay Components"
Cohesion: 0.22
Nodes (7): DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerPortal(), DrawerTitle()

### Community 28 - "Navigation Menu Components"
Cohesion: 0.24
Nodes (9): NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger(), navigationMenuTriggerStyle (+1 more)

### Community 29 - "Application Bootstrap Strategy"
Cohesion: 0.22
Nodes (7): Application Composition, URL-Synced List State, JavaScript Runtime Requirement, Refine HTML Shell, Refine Page Metadata, Root Mount Point, src/index.tsx Entrypoint

### Community 30 - "Vite Build Configuration"
Cohesion: 0.22
Nodes (6): @tailwindcss/vite@^4.1.8, vite@^6.3.5, @vitejs/plugin-react@^4.4.1, @tailwindcss/vite, vite, @vitejs/plugin-react

### Community 31 - "Pagination Controls"
Cohesion: 0.28
Nodes (7): Pagination(), PaginationContent(), PaginationEllipsis(), PaginationLink(), PaginationLinkProps, PaginationNext(), PaginationPrevious()

### Community 32 - "Turborepo Build Configuration"
Cohesion: 0.25
Nodes (7): //, env, outputs, extends, $schema, tasks, build

### Community 33 - "React Error Boundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, ErrorBoundaryProps, ErrorBoundaryState

### Community 34 - "Toast Notification System"
Cohesion: 0.33
Nodes (4): sonner@^2.0.3, sonner, UndoableNotification(), useNotificationProvider()

### Community 35 - "Package Command Scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, refine, typecheck

### Community 37 - "Alert Message Components"
Cohesion: 0.50
Nodes (4): Alert(), AlertDescription(), AlertTitle(), alertVariants

### Community 38 - "Super Admin Platform Overview"
Cohesion: 0.50
Nodes (3): Frontend Technology Stack, Platform Scope, Super Admin Dashboard

### Community 41 - "Browser Target Configuration"
Cohesion: 0.67
Nodes (3): browserslist, development, production

## Knowledge Gaps
- **22 isolated node(s):** `//`, `Platform Scope`, `Frontend Technology Stack`, `URL-Synced List State`, `API Error Normalization` (+17 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 233 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Advanced Interaction Components` to `Refine CRUD Views`, `Subscription Plans and Usage`, `Dashboard and Tenant Details`, `Payment Operations and History`, `Filtering Dialog Components`, `Form Schemas and Fields`, `Administrative Data Tables`, `Header Theme Controls`, `Responsive Sidebar Components`, `Dashboard Layout Navigation`, `Application Routes and Resources`, `Toggle Control Components`, `Sidebar Sheet Components`, `User Identity Display`, `Chart Visualization Components`, `Drawer Overlay Components`, `Navigation Menu Components`, `Pagination Controls`, `Toast Notification System`, `Alert Message Components`, `Hover Card Components`?**
  _High betweenness centrality (0.324) - this node is a cross-community bridge._
- **What connects `//`, `Platform Scope`, `Frontend Technology Stack` to the rest of the system?**
  _22 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Refine CRUD Views` be split into smaller, more focused modules?**
  _Cohesion score 0.05822267620020429 - nodes in this community are weakly interconnected._
- **Why does `react` connect `Refine CRUD Views` to `Subscription Plans and Usage`, `Dashboard and Tenant Details`, `Payment Operations and History`, `Filtering Dialog Components`, `Advanced Interaction Components`, `Form Schemas and Fields`, `Core Runtime Dependencies`, `Administrative Data Tables`, `Header Theme Controls`, `Responsive Sidebar Components`, `Application Package Metadata`, `Dashboard Layout Navigation`, `Application Routes and Resources`, `Toggle Control Components`, `Sidebar Sheet Components`, `User Identity Display`, `Chart Visualization Components`, `Drawer Overlay Components`, `Navigation Menu Components`, `Pagination Controls`, `React Error Boundary`, `Alert Message Components`, `Hover Card Components`, `React Root Mounting`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Should `Subscription Plans and Usage` be split into smaller, more focused modules?**
  _Cohesion score 0.0546218487394958 - nodes in this community are weakly interconnected._
- **Why does `@refinedev/core` connect `Refine CRUD Views` to `Subscription Plans and Usage`, `Dashboard and Tenant Details`, `Payment Operations and History`, `Filtering Dialog Components`, `Toast Notification System`, `Form Schemas and Fields`, `Core Runtime Dependencies`, `Administrative Data Tables`, `Header Theme Controls`, `Responsive Sidebar Components`, `Application Package Metadata`, `Dashboard Layout Navigation`, `Application Routes and Resources`, `Tenant Data Provider`, `Authentication Session Flow`, `User Identity Display`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Should `Dashboard and Tenant Details` be split into smaller, more focused modules?**
  _Cohesion score 0.14234511008704556 - nodes in this community are weakly interconnected._
