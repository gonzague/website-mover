import { useState, useEffect } from 'react';
import { listPath, type FileItem } from '../../api/rclone';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Folder, File, ChevronLeft, Loader2 } from 'lucide-react';
import { toast } from '../../hooks/use-toast';

interface FileBrowserDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    remoteName: string;
    initialPath?: string;
    onSelect: (path: string) => void;
    title?: string;
}

export function FileBrowserDialog({
    open,
    onOpenChange,
    remoteName,
    initialPath = '',
    onSelect,
    title = 'Select Path',
}: FileBrowserDialogProps) {
    const [currentPath, setCurrentPath] = useState(initialPath);
    const [items, setItems] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && remoteName) {
            loadPath(currentPath);
        }
    }, [open, remoteName, currentPath]);

    const loadPath = async (path: string) => {
        setLoading(true);
        try {
            const data = await listPath(remoteName, path);
            // Sort: directories first, then files
            const sorted = data.sort((a, b) => {
                if (a.is_dir === b.is_dir) {
                    return a.name.localeCompare(b.name);
                }
                return a.is_dir ? -1 : 1;
            });
            setItems(sorted);
        } catch (error) {
            console.error('Failed to list path:', error);
            toast({
                title: "Error",
                description: "Failed to list directory contents",
                type: "error"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleNavigate = (item: FileItem) => {
        if (item.is_dir) {
            // Construct new path
            const newPath = currentPath
                ? `${currentPath}/${item.name}`
                : item.name;
            setCurrentPath(newPath);
        } else {
            // It's a file, maybe just select it?
            // For now, let's assume we can select files too if needed
        }
    };

    const handleUp = () => {
        if (!currentPath) return;
        const parts = currentPath.split('/');
        parts.pop();
        setCurrentPath(parts.join('/'));
    };

    const handleSelectCurrent = () => {
        onSelect(currentPath || '/');
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>

                <div className="flex items-center gap-2 p-2 bg-muted rounded-md mb-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleUp}
                        disabled={!currentPath}
                        title="Go Up"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="font-mono text-sm truncate flex-1">
                        {remoteName}:{currentPath || '/'}
                    </div>
                </div>

                <ScrollArea className="flex-1 border rounded-md h-[400px]">
                    <div className="p-2 space-y-1">
                        {loading ? (
                            <div className="flex justify-center items-center h-32">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : items.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Empty directory
                            </div>
                        ) : (
                            items.map((item) => (
                                <div
                                    key={item.name}
                                    className="flex items-center gap-3 p-2 hover:bg-accent rounded-sm cursor-pointer text-sm"
                                    onClick={() => handleNavigate(item)}
                                >
                                    {item.is_dir ? (
                                        <Folder className="h-4 w-4 text-blue-500 fill-blue-500/20" />
                                    ) : (
                                        <File className="h-4 w-4 text-gray-500" />
                                    )}
                                    <span className="flex-1 truncate">{item.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {!item.is_dir && formatSize(item.size)}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSelectCurrent}>
                        Select Current Folder
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
