# KSP Crime AI Frontend Subsystem

This subdirectory houses the React client application built with Vite, TypeScript, custom CSS3 styles, Leaflet maps, and Vis.js network graphs.

---

## Directory Structure & Contents

### 1. [public/](file:///C:/Users/adhik/OneDrive/Desktop/ksp-crime-ai/frontend/public) (Static Assets)
Contains global static assets, configuration assets, and standard web resources.

### 2. [src/](file:///C:/Users/adhik/OneDrive/Desktop/ksp-crime-ai/frontend/src) (React Source Code)
Houses main application components, services, global style layouts, state models, and type interfaces.

### 3. [package.json](file:///C:/Users/adhik/OneDrive/Desktop/ksp-crime-ai/frontend/package.json) (NPM Configuration)
Defines project scripts, compiler constraints, and package dependencies:
* `react` & `react-dom` (Core UI library components)
* `leaflet` & `react-leaflet` (Geospatial mapping and map layer utilities)
* `vis-network` & `vis-uuid` (Node-link network graph rendering)
* `recharts` (Time-series data visualizations)
* `axios` (HTTP connector calls targeting FastAPI endpoints)

### 4. [vite.config.ts](file:///C:/Users/adhik/OneDrive/Desktop/ksp-crime-ai/frontend/vite.config.ts) (Vite Settings)
Configures TypeScript loaders, server ports, local proxies, and development bundling rules.

---

## Running the Application

To install dependencies and start the local development server:

1. Ensure Node.js 18+ is installed.
2. Install package dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Access the web dashboard in your browser at `http://localhost:5173/`.
