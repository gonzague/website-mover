import { useToast } from "../../hooks/use-toast";

export function Toaster() {
    const { toasts } = useToast();

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`min-w-[300px] rounded-lg p-4 shadow-lg transition-all ${toast.type === "error"
                            ? "bg-red-500 text-white"
                            : toast.type === "success"
                                ? "bg-green-500 text-white"
                                : "bg-white text-gray-900 border border-gray-200"
                        }`}
                >
                    <h3 className="font-semibold">{toast.title}</h3>
                    {toast.description && <p className="text-sm opacity-90">{toast.description}</p>}
                </div>
            ))}
        </div>
    );
}
