import { useState, useEffect } from "react";

type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
    id: string;
    title: string;
    description?: string;
    type?: ToastType;
}

let listeners: ((toasts: Toast[]) => void)[] = [];
let toasts: Toast[] = [];

function notifyListeners() {
    listeners.forEach((listener) => listener([...toasts]));
}

export function toast(props: Omit<Toast, "id">) {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { ...props, id };
    toasts = [...toasts, newToast];
    notifyListeners();

    setTimeout(() => {
        toasts = toasts.filter((t) => t.id !== id);
        notifyListeners();
    }, 3000);
}

export function useToast() {
    const [activeToasts, setActiveToasts] = useState<Toast[]>(toasts);

    useEffect(() => {
        listeners.push(setActiveToasts);
        return () => {
            listeners = listeners.filter((l) => l !== setActiveToasts);
        };
    }, []);

    return { toasts: activeToasts };
}
