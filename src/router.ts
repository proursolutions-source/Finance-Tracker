/**
 * Router - Hash-based SPA routing
 */

type RouteHandler = () => void | Promise<void>;

interface Route {
    path: string;
    handler: RouteHandler;
    requiresAuth?: boolean;
}

class Router {
    private routes: Map<string, Route> = new Map();
    private currentPath: string = '';
    private onboardingRequired: boolean = true;

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
        let route = this.routes.get(path);

        // If not found, try default route
        if (!route) {
            route = this.routes.get('/');
        }

        if (route) {
            try {
                await route.handler();
            } catch (error) {
                console.error('[Router] Error handling route:', error);
                // Could show error page here
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
}

// Singleton instance
export const router = new Router();
