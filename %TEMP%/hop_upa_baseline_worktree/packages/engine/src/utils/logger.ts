/**
 * Persists a log message to a file, safe for both Node and Browser environments.
 * In a browser environment, this is a no-op.
 * In a Node environment, it appends the message to the specified file.
 */
export const persistLog = async (filename: string, message: string) => {
    // Vite will ignore this block during tree-shaking/bundling if handled correctly,
    // but the simplest way is a runtime check.
    if (typeof window === 'undefined') {
        try {
            // We use a dynamic import to hide 'fs' from the bundler's initial scan
            const fs = await import('fs');
            fs.appendFileSync(filename, message);
        } catch (error) {
            // Silently fail if fs is not available or if there's an error writing
            console.warn(`Failed to persist log to ${filename}:`, error);
        }
    }
};
