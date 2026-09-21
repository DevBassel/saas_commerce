# tenant_dash

<div align="center" style="margin: 30px;">
    <a href="https://refine.dev">
    <img alt="refine logo" src="https://refine.ams3.cdn.digitaloceanspaces.com/readme/refine-readme-banner.png">
    </a>
</div>
<br/>

This [Refine](https://github.com/refinedev/refine) project was generated with [create refine-app](https://github.com/refinedev/refine/tree/master/packages/create-refine-app).

## Getting Started

A React Framework for building internal tools, admin panels, dashboards & B2B apps with unmatched flexibility ✨

Refine's hooks and components simplifies the development process and eliminates the repetitive tasks by providing industry-standard solutions for crucial aspects of a project, including authentication, access control, routing, networking, state management, and i18n.

## Available Scripts

### Running the development server.

```bash
    pnpm dev
```

### Building for production.

```bash
    pnpm build
```

### Running the production server.

```bash
    pnpm start
```

## Learn More

To learn more about **Refine**, please check out the [Documentation](https://refine.dev/docs)

- **REST Data Provider** [Docs](https://refine.dev/docs/core/providers/data-provider/#overview)
- **shadcn/ui** [Docs](https://refine.dev/docs/guides-concepts/general-concepts/#headless-concept)
- **React Router** [Docs](https://refine.dev/docs/core/providers/router-provider/)
- **Custom Auth Provider** [Docs](https://refine.dev/docs/core/providers/auth-provider/)

## Authentication & Authorization

- Auth is handled by a custom Refine `authProvider` (`src/providers/auth.ts`) backed by a REST
  API. Access/refresh tokens are stored in `localStorage` and attached by an Axios interceptor
  (`src/api/client.ts`).
- The tenant is inferred from the hostname subdomain and sent as `x-tenant-slug`. The frontend
  performs a best-effort check that the session tenant matches the host (`src/api/tenant.ts`);
  **this is a UX guard only**.
- The application is currently **single-role** (tenant owner). There is no frontend
  authorization/RBAC layer. **The backend MUST enforce authentication and authorization
  independently.** Frontend checks must never be treated as a security boundary.
- `refresh` is attempted against `POST /api/v1/auth/refresh` on a 401 response; failure clears
  the session and redirects to `/login`.

## Environment

Copy `.env.example` to `.env` and set:

```bash
VITE_API_URL=https://api.example.com/api/v1
```

## License

MIT
