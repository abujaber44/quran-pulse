import { createNavigationContainerRef } from '@react-navigation/native';

// App-level navigation handle so services (e.g. notification tap handling)
// can navigate without a screen's navigation prop.
export const navigationRef = createNavigationContainerRef();

// A notification tap can arrive before the NavigationContainer is ready
// (cold start). Queue the navigation and flush it from onReady.
let pendingNavigation: (() => void) | null = null;

export function navigateWhenReady(action: () => void): void {
  if (navigationRef.isReady()) {
    action();
  } else {
    pendingNavigation = action;
  }
}

export function flushPendingNavigation(): void {
  if (pendingNavigation && navigationRef.isReady()) {
    const action = pendingNavigation;
    pendingNavigation = null;
    action();
  }
}
