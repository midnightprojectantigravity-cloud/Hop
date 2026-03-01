export type EngineLogLevel = 'INFO' | 'VERBOSE' | 'DEBUG' | 'CRITICAL';
export type EngineLogChannel = 'COMBAT' | 'HAZARD' | 'OBJECTIVE' | 'AI' | 'SYSTEM';

const TAG_PATTERN = /^\[(INFO|VERBOSE|DEBUG|CRITICAL)\|([A-Z_]+)\]\s*/i;

export const isTaggedMessage = (text: string): boolean => TAG_PATTERN.test(text);

export const tagMessage = (
    text: string,
    level: EngineLogLevel = 'INFO',
    channel: EngineLogChannel = 'SYSTEM'
): string => {
    if (!text) return '';
    if (isTaggedMessage(text)) return text;
    return `[${level}|${channel}] ${text}`;
};

export const tagMessages = (
    messages: string[],
    level: EngineLogLevel = 'INFO',
    channel: EngineLogChannel = 'SYSTEM'
): string[] => messages.map(m => tagMessage(m, level, channel)).filter(Boolean);

export const appendTaggedMessage = (
    existing: string[] | undefined,
    text: string,
    level: EngineLogLevel,
    channel: EngineLogChannel,
    limit: number = 50
): string[] => {
    const next = tagMessage(text, level, channel);
    const base = [...(existing || [])];
    if (next && base[base.length - 1] === next) return base.slice(-limit);
    return [...base, next].slice(-limit);
};

export const appendTaggedMessages = (
    existing: string[] | undefined,
    messages: string[],
    level: EngineLogLevel,
    channel: EngineLogChannel,
    limit: number = 50
): string[] => {
    const out = [...(existing || [])];
    let lastIncoming: string | undefined;
    for (const msg of tagMessages(messages, level, channel)) {
        // Deduplicate only inside the same append batch.
        if (msg && lastIncoming === msg) continue;
        out.push(msg);
        lastIncoming = msg;
    }
    return out.slice(-limit);
};
