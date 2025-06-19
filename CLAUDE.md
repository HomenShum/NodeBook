# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `yarn dev` - Start development server (Next.js)
- `yarn build` - Production build
- `yarn start` - Start production server

### Code Quality
- `yarn lint` / `yarn lint:fix` - ESLint checking/fixing
- `yarn typecheck` - TypeScript type checking  
- `yarn test` - Jest test suite
- `yarn ci-tests` - Complete CI pipeline (lint + typecheck + test)

### Database Operations
- `yarn db:generate` - Generate Drizzle migrations
- `yarn db:migrate` - Apply database migrations
- `yarn db:reset` - Reset database
- `yarn db:export` - Export database

### Setup Commands
- `yarn vercel:link` - Link to Vercel project
- `yarn vercel env pull --environment=development .env.local` - Pull environment variables

## Architecture Overview

**Mew** is a knowledge graph application built with Next.js 14 App Router, TypeScript, and MobX for state management. The core concept is a hypergraph where both nodes and relations can have relations to other entities.

### Key Technologies
- **Next.js 14** with App Router architecture
- **TypeScript** with strict mode
- **MobX** for reactive state management
- **Drizzle ORM** with PostgreSQL
- **Lexical** for rich text editing
- **D3.js + PIXI.js** for graph visualization

### Core Architecture

**Graph System (`/src/app/graph/`)**
- `GraphStore.ts` - Central MobX store managing graph state
- `GraphNode.ts` & `GraphRelation.ts` - Core data models
- `UpdateManager.ts` - Handles mutations and real-time sync
- Uses fractional indexing for efficient list operations
- Real-time synchronization via Pusher

**Database Layer (`/src/db/`)**
- Drizzle ORM with PostgreSQL schema
- 36+ migrations in `/migrations/` directory
- Trigram search indexing support
- Main tables: users, graph_nodes, graph_relations, graph_relation_lists

**Editor System (`/src/app/editor/`)**
- Lexical-based rich text editor with custom plugins
- Context-aware mentions and AI integration
- Custom dropdown system for commands and entity references

**API Routes (`/src/app/api/`)**
- RESTful endpoints for graph operations
- AI-powered features (entity extraction, contextual generation)
- Search with both server and client-side components
- File upload and transcription services

### Development Setup

**Prerequisites:**
- Node.js v22.14.0
- Yarn package manager
- Vercel CLI for environment variables

**Environment Setup:**
1. Run `yarn vercel:link` to link to Vercel project
2. Run `yarn vercel env pull --environment=development .env.local` to get environment variables
3. Set `NEXT_PUBLIC_PERSISTENCE_ENABLED=true` and `NEXT_PUBLIC_IS_AUTH_ENABLED=true` in `.env.local` to enable persistence
4. Change `POSTGRES_CUSTOM_URL` to point to `mew_lite` for development database

**For Database Schema Changes:**
Create a personal test database to avoid conflicts:
1. Go to Vercel database dashboard
2. Run `create database <your-db-name>`
3. Update `POSTGRES_CUSTOM_URL` in `.env.local` with new database name
4. Run `yarn db:migrate` to apply schema
5. Delete database when done with `drop database <your-db-name>`

### Important Patterns

**MobX Reactive State:**
- Graph data is managed through observable MobX stores
- UI automatically updates when observable data changes
- Stores injected via React Context

**Fractional Indexing:**
- Used for efficient ordering of lists and relations
- Allows insertion between items without reordering entire collections

**Layer-Based Data Loading:**
- Progressive loading with placeholder objects
- Different data types loaded in separate layers
- Efficient serialization/deserialization

**Real-time Synchronization:**
- Pusher WebSocket integration for live updates
- Optimistic updates with conflict resolution
- Updates managed through `UpdateManager`

### File Structure Notes

- `/src/app/[[...path]]/page.tsx` - Dynamic routing for graph navigation
- `/src/app/components/` - Reusable UI components with CSS Modules
- `/src/app/stores/` - MobX store definitions and context providers
- `/scripts/` - Database utilities and batch operations
- Root route redirects to `/g` for the main graph interface