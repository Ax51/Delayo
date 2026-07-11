import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import React from 'react';

import CustomDelayView from './views/CustomDelayView';
import MainView from './views/MainView';
import ManageTabsView from './views/ManageTabsView';
import NotFoundView from './views/NotFoundView';
import RecurringDelayView from './views/RecurringDelayView';

const rootRoute = createRootRoute({
  notFoundComponent: NotFoundView,
});

const mainRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (search: Record<string, unknown>) => ({
    remindOnly: search.remindOnly === true,
  }),
  component: MainView,
});

const customDelayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/custom-delay',
  validateSearch: (search: Record<string, unknown>) => ({
    tabId: typeof search.tabId === 'string' ? search.tabId : undefined,
    remindOnly: search.remindOnly === true,
  }),
  component: CustomDelayView,
});

const recurringDelayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/recurring-delay',
  validateSearch: (search: Record<string, unknown>) => ({
    remindOnly: search.remindOnly === true,
  }),
  component: RecurringDelayView,
});

const manageTabsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/manage-tabs',
  component: ManageTabsView,
});

const routeTree = rootRoute.addChildren([
  mainRoute,
  customDelayRoute,
  recurringDelayRoute,
  manageTabsRoute,
]);

const memoryHistory = createMemoryHistory({
  initialEntries: ['/'],
});

const router = createRouter({
  routeTree,
  history: memoryHistory,
  defaultPreload: 'render',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export default function Router() {
  return <RouterProvider router={router} />;
}
