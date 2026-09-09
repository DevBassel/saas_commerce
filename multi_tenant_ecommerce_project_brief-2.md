# Multi-Tenant E-Commerce SaaS Platform

## Project Overview

A scalable multi-tenant e-commerce platform built with **NestJS**,
**PostgreSQL**, and **REST API architecture**.

The platform allows multiple stores (tenants) to operate independently
using isolated PostgreSQL schemas while sharing the same application
infrastructure.

Each tenant has its own subdomain and isolated business data.

Example:

-   `nike.platform.com`
-   `amazon.platform.com`
-   `store1.platform.com`

------------------------------------------------------------------------

## Architecture Overview

    Users
      |
      v
    Tenant Subdomain
      |
      v
    NestJS REST API
      |
      v
    Tenant Resolver
      |
      v
    PostgreSQL
      |
      +-- public schema
      |
      +-- tenant_nike schema
      |
      +-- tenant_amazon schema

------------------------------------------------------------------------

## Multi-Tenancy Model

The system uses **Schema-per-Tenant isolation**.

### Public Schema

Contains platform-level data:

-   Tenants
-   Users
-   Roles
-   Permissions
-   Subscription plans
-   Billing information
-   Domain mapping

### Tenant Schema

Each tenant has a separated schema containing:

-   Products
-   Categories
-   Customers
-   Orders
-   Inventory
-   Payments
-   Store settings

Example:

    public

    tenant_nike
        products
        orders
        customers

    tenant_amazon
        products
        orders
        customers

------------------------------------------------------------------------

## Tenant Subdomain System

Every tenant receives a unique subdomain.

Example:

    nike.platform.com

Request flow:

1.  User opens tenant URL
2.  System identifies subdomain
3.  Tenant resolver finds tenant information
4.  Application switches to tenant schema
5.  Request executes inside tenant isolation

------------------------------------------------------------------------

## Technology Stack

### Backend

-   NestJS
-   TypeScript
-   REST API
-   TypeORM

### Database

-   PostgreSQL
-   Schema-per-tenant isolation

### Infrastructure

-   Docker
-   Redis
-   BullMQ
-   RabbitMQ (future event architecture)

### Storage

-   S3 compatible storage / Cloudflare R2

------------------------------------------------------------------------

## Core Modules

### Platform Modules

-   Authentication
-   Tenant Management
-   User Management
-   Roles & Permissions
-   Subscription Management
-   Billing

### Tenant Modules

-   Product Management
-   Category Management
-   Inventory
-   Customer Management
-   Cart
-   Orders
-   Payments
-   Shipping
-   Reports

------------------------------------------------------------------------

## User Roles

### Platform Level

-   Super Admin

### Tenant Level

-   Store Owner
-   Admin
-   Manager
-   Employee
-   Customer

------------------------------------------------------------------------

## Security Goals

-   Complete tenant data isolation
-   Tenant resolved from trusted domain/token
-   No cross-tenant access
-   Role-based authorization
-   Audit logging

------------------------------------------------------------------------

## Development Approach

Start as a modular monolith:

    NestJS Application
            |
            |
    PostgreSQL
            |
    Schema-per-tenant

The architecture should allow future extraction into microservices when
scaling requires it.

------------------------------------------------------------------------

## Development Phases

### Phase 1 - Foundation

-   NestJS setup
-   PostgreSQL setup
-   Authentication
-   Tenant management
-   Schema management

### Phase 2 - Tenant Engine

-   Subdomain resolution
-   Tenant context handling
-   Database isolation

### Phase 3 - E-Commerce Features

-   Products
-   Categories
-   Inventory
-   Customers

### Phase 4 - Commerce Flow

-   Cart
-   Orders
-   Payments
-   Shipping

### Phase 5 - SaaS Features

-   Subscriptions
-   Plans
-   Usage limits
-   Billing

### Phase 6 - Scaling

-   Caching
-   Background jobs
-   Event-driven architecture
-   Monitoring

------------------------------------------------------------------------

## Final Goal

Build a secure, scalable SaaS e-commerce platform where thousands of
independent stores can run on shared infrastructure with isolated data
and customized store environments.
