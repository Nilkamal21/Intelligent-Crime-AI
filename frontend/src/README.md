# React Source Module (`frontend/src`)

This folder contains the core React client code, global stylesheets, and application entrypoints.

---

## File Contents & Code Blocks

### 1. [main.tsx](file:///C:/Users/adhik/OneDrive/Desktop/ksp-crime-ai/frontend/src/main.tsx) (Application Bootstrapper)
* **What it does**: Renders the React `<App />` root component tree inside the DOM node labeled `#root` in `index.html`.
* **Why we do it**: Standard entrypoint for Vite to compile the frontend application bundle.

---

### 2. [App.tsx](file:///C:/Users/adhik/OneDrive/Desktop/ksp-crime-ai/frontend/src/App.tsx) (Dashboard Coordinator)

#### State Hook Mappings
* **`session`**: Stores the active user session, including their username, JWT token, and role (`Investigator`, `Analyst`, `Supervisor`, `Policymaker`).
  * *Why we do it*: Controls access to the dashboard and restricts features based on user roles.
* **`currentTab`**: Tracks the active tab panel in the sidebar menu (e.g. Chatbot, Hotspot Map, Trends).
  * *Why we do it*: Controls which dashboard component is currently displayed in the main viewport.
* **`chatMessages` & `chatSessionId`**: Stores the conversation history and a unique session ID.
  * *Why we do it*: Hoists chat state to the root level so conversation history is preserved when switching tabs.
* **`alerts` & `unreadCount`**: Stores list of alerts and tracks the number of unread alerts.
  * *Why we do it*: Manages the notifications feed and updates the sidebar badge in real time.
* **`visitedTabs`**: Tracks which tabs the user has opened.
  * *Why we do it*: Lazy-mounts dashboard panels on first visit to speed up initial load times, keeping components in the DOM to preserve their state.

#### Lifecycle Hooks (`useEffect`)
* **Auto-Login Check (Initial Render)**: Scans `localStorage` for `ksp_access_token`, `ksp_role`, and `ksp_username`.
  * *Why we do it*: Automatically logs users back in if they refresh their browser with a valid session.
* **Standing Alerts Fetcher (Login Event)**: Fetches standing alerts from `/api/alerts/standing` once a user session is active.
  * *Why we do it*: Populates the notifications feed with existing alerts on login.
* **Unread Counter Reset**: Resets the unread count to 0 when the user opens the alerts tab.
  * *Why we do it*: Clears the notification badge once the alerts feed has been viewed.
* **Tab Switch Listener**: Mounts a global listener for the custom `ksp-change-tab` window event.
  * *Why we do it*: Allows nested components (like the Chatbot RAG brief) to trigger tab switches automatically.

#### Handler Functions
* **`handleLoginSuccess(username, role, token)`**: Saves session details to local state and storage, then redirects the user to the chatbot tab.
  * *Why we do it*: Logs users in securely and redirects them to the search dashboard.
* **`handleLogout()`**: Clears local storage and resets conversation states.
  * *Why we do it*: Safely ends sessions and clears temporary data from memory.
