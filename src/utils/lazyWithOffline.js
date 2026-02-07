import React, { useState, useEffect, Suspense, lazy } from 'react';

/**
 * Offline-aware lazy loading wrapper
 * 
 * Wraps lazy-loaded components with a dedicated error boundary
 * that gracefully handles ChunkLoadError when offline.
 */

/**
 * Offline fallback component shown when lazy loading fails
 */
const OfflineFallback = ({ retry }) => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            // Auto-retry when back online
            setTimeout(() => {
                if (retry) retry();
                else window.location.reload();
            }, 500);
        };
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [retry]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="text-center max-w-md">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-3xl">{isOnline ? '⏳' : '📴'}</span>
                </div>
                <h1 className="text-xl font-bold text-foreground mb-2">
                    {isOnline ? 'Loading...' : "You're Offline"}
                </h1>
                <p className="text-muted-foreground mb-4">
                    {isOnline
                        ? 'Retrying connection...'
                        : 'This page needs an internet connection to load. Please check your network and try again.'
                    }
                </p>
                {!isOnline && (
                    <button
                        onClick={() => {
                            if (retry) retry();
                            else window.location.reload();
                        }}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                    >
                        Retry
                    </button>
                )}
            </div>
        </div>
    );
};

/**
 * Error boundary specifically for catching ChunkLoadError
 */
class LazyErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        // Only catch chunk load errors
        if (
            error.name === 'ChunkLoadError' ||
            error.message?.includes('Loading chunk') ||
            error.message?.includes('Failed to fetch dynamically imported module')
        ) {
            return { hasError: true };
        }
        // Re-throw other errors to parent boundary
        throw error;
    }

    componentDidCatch(error, errorInfo) {
        console.log('LazyErrorBoundary caught:', error.name, error.message);
    }

    retry = () => {
        this.setState({ hasError: false });
    };

    render() {
        if (this.state.hasError) {
            return <OfflineFallback retry={this.retry} />;
        }
        return this.props.children;
    }
}

/**
 * Create a lazy-loaded component with offline fallback
 * @param {Function} importFn - The dynamic import function, e.g., () => import('./pages/Login')
 * @param {string} moduleName - Unique name for caching purposes (optional)
 * @returns {React.ComponentType}
 */
export const lazyWithOffline = (importFn, moduleName) => {
    const LazyComponent = lazy(importFn);

    // Return a wrapper component that includes the error boundary
    const WrappedComponent = (props) => (
        <LazyErrorBoundary>
            <LazyComponent {...props} />
        </LazyErrorBoundary>
    );

    WrappedComponent.displayName = `LazyOffline(${moduleName || 'Component'})`;

    return WrappedComponent;
};

export { OfflineFallback, LazyErrorBoundary };
export default lazyWithOffline;
