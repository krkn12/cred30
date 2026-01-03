import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook para debounce de valores
 * Útil para evitar requisições excessivas ao digitar
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(timer);
        };
    }, [value, delay]);

    return debouncedValue;
}

/**
 * Hook para debounce de callbacks
 * Útil para handlers de eventos
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
    callback: T,
    delay: number = 300
): T {
    const callbackRef = useRef(callback);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Atualizar ref quando callback mudar
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    const debouncedCallback = useCallback(
        (...args: Parameters<T>) => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            timeoutRef.current = setTimeout(() => {
                callbackRef.current(...args);
            }, delay);
        },
        [delay]
    ) as T;

    // Cleanup no unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return debouncedCallback;
}

/**
 * Hook para throttle de callbacks
 * Útil para scroll handlers e resize
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
    callback: T,
    delay: number = 100
): T {
    const lastRunRef = useRef<number>(0);
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    const throttledCallback = useCallback(
        (...args: Parameters<T>) => {
            const now = Date.now();
            if (now - lastRunRef.current >= delay) {
                lastRunRef.current = now;
                callbackRef.current(...args);
            }
        },
        [delay]
    ) as T;

    return throttledCallback;
}

/**
 * Hook para memoização de objetos pesados
 * Evita re-renders desnecessários
 */
export function useDeepMemo<T>(value: T, deps: React.DependencyList): T {
    const ref = useRef<T>(value);
    const depsRef = useRef<React.DependencyList>(deps);

    const depsChanged = deps.some((dep, i) => {
        return !Object.is(dep, depsRef.current[i]);
    });

    if (depsChanged) {
        ref.current = value;
        depsRef.current = deps;
    }

    return ref.current;
}

/**
 * Hook para executar callback apenas uma vez (mount)
 */
export function useOnMount(callback: () => void | (() => void)) {
    const hasRun = useRef(false);

    useEffect(() => {
        if (!hasRun.current) {
            hasRun.current = true;
            return callback();
        }
    }, []);
}

/**
 * Hook para preload de rotas críticas
 * Carrega componentes no idle time
 */
export function usePrefetch(importFn: () => Promise<any>) {
    useEffect(() => {
        if ('requestIdleCallback' in window) {
            const id = (window as any).requestIdleCallback(() => {
                importFn();
            });
            return () => (window as any).cancelIdleCallback(id);
        } else {
            // Fallback para browsers sem requestIdleCallback
            const timer = setTimeout(() => {
                importFn();
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [importFn]);
}

/**
 * Hook para local storage com sync entre tabs
 */
export function useLocalStorage<T>(
    key: string,
    initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch {
            return initialValue;
        }
    });

    const setValue = useCallback(
        (value: T | ((prev: T) => T)) => {
            try {
                const valueToStore = value instanceof Function ? value(storedValue) : value;
                setStoredValue(valueToStore);
                window.localStorage.setItem(key, JSON.stringify(valueToStore));
            } catch (error) {
                console.warn(`Error setting localStorage key "${key}":`, error);
            }
        },
        [key, storedValue]
    );

    // Sync entre tabs
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === key && e.newValue) {
                setStoredValue(JSON.parse(e.newValue));
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [key]);

    return [storedValue, setValue];
}
