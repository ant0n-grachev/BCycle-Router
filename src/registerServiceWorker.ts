export function registerServiceWorker(): void {
    if (process.env.NODE_ENV === "development") {
        return;
    }

    if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
            navigator.serviceWorker
                .register(`${process.env.PUBLIC_URL}/service-worker.js`)
                .catch((error) => {
                    if (process.env.NODE_ENV !== "production") {
                        console.error("Service worker registration failed:", error);
                    }
                });
        });
    }
}
