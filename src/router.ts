/**
 * Router - Hash-based SPA routing
 */

type RouteHandler = () => void | Promise<void>;
type NotFoundHandler = (path: string) => void | Promise<void>;

interface Route {
    path: string;
    handler: RouteHandler;
    requiresAuth?: boolean;
}

class Router {
    private routes: Map<string, Route> = new Map();
    private currentPath: string = '';
    private onboardingRequired: boolean = true;
    private notFoundHandler: NotFoundHandler | null = null;

    /**
     * Register a handler shown for any hash path that doesn't match a
     * registered route, instead of silently falling back to "/".
     */
    setNotFoundHandler(handler: NotFoundHandler): void {
        this.notFoundHandler = handler;
    }

    /**
     * Register a route
     */
    register(path: string, handler: RouteHandler, requiresAuth: boolean = true): void {
        this.routes.set(path, { path, handler, requiresAuth });
    }

    /**
     * Navigate to a path
     */
    navigate(path: string): void {
        window.location.hash = path;
    }

    /**
     * Get current path from hash
     */
    private getPath(): string {
        return window.location.hash.slice(1) || '/';
    }

    /**
     * Set onboarding status
     */
    setOnboardingRequired(required: boolean): void {
        this.onboardingRequired = required;
    }

    /**
     * Handle route change
     */
    private async handleRoute(): Promise<void> {
        const path = this.getPath();

        // Prevent duplicate navigation
        if (path === this.currentPath) return;

        this.currentPath = path;

        // Check if onboarding is required and not on onboarding page
        if (this.onboardingRequired && path !== '/onboarding') {
            this.navigate('/onboarding');
            return;
        }

        // Find matching route
        const route = this.routes.get(path);

        if (route) {
            try {
                await route.handler();
            } catch (error) {
                console.error('[Router] Error handling route:', error);
            }
            return;
        }

        // Unknown path - show a real 404 instead of silently rendering "/"
        if (this.notFoundHandler) {
            try {
                await this.notFoundHandler(path);
            } catch (error) {
                console.error('[Router] Error handling not-found route:', error);
            }
        } else {
            console.warn('[Router] No handler for path:', path);
        }
    }

    /**
     * Start listening to hash changes
     */
    start(): void {
        window.addEventListener('hashchange', () => this.handleRoute());

        // Handle initial route
        this.handleRoute();
    }

    /**
     * Get query parameters from hash
     */
    getQueryParams(): URLSearchParams {
        const hash = window.location.hash;
        const queryStart = hash.indexOf('?');

        if (queryStart === -1) return new URLSearchParams();

        return new URLSearchParams(hash.slice(queryStart));
    }
    /**
     * Reload current route (bypasses duplicate-path guard)
     */
    async reload(): Promise<void> {
        this.currentPath = '';
        await this.handleRoute();
    }
}

// Singleton instance
export const router = new Router();
