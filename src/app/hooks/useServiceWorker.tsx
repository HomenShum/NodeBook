import {useEffect} from "react";

import logger from "@/lib/logger";

function useServiceWorker() {
    useEffect(() => {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker
                .register('/sw.js')
                .catch((error) => {
                    logger.error('Service Worker registration failed:', error);
                });
        }
    }, []);
}

export default useServiceWorker;