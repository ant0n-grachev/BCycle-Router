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
                const message =
                    err && typeof (err as any).message === "string"
                        ? (err as any).message
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
