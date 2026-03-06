import {useCallback, useRef} from "react";

interface Handlers<T> {
    onSuccess?: (value: T) => void;
    onError?: (message: string) => void;
    onFinally?: () => void;
    errorMessage?: string;
}

export function useLatestAsync() {
    const seqRef = useRef(0);

    return useCallback(
        async <T>(task: () => Promise<T>, handlers: Handlers<T> = {}) => {
            const requestId = ++seqRef.current;
            try {
                const result = await task();
                if (seqRef.current !== requestId) return;
                handlers.onSuccess?.(result);
            } catch (err) {
                if (seqRef.current !== requestId) return;
                const error = err as {message?: unknown} | null;
                const message =
                    error && typeof error.message === "string"
                        ? error.message
                        : handlers.errorMessage || "Something went wrong.";
                handlers.onError?.(message);
            } finally {
                if (seqRef.current !== requestId) return;
                handlers.onFinally?.();
            }
        },
        []
    );
}
