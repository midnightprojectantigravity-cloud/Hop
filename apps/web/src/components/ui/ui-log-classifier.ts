import type { ClassifiedLog } from './ui-log-types';

export const classifyMessage = (raw: string, idx: number): ClassifiedLog => {
  const msg = raw || '';
  const lower = msg.toLowerCase();
  const tagged = msg.match(/^\[(INFO|VERBOSE|DEBUG|CRITICAL)\|([A-Z_]+)\]\s*(.*)$/i);
  if (tagged) {
    const level = tagged[1]!.toLowerCase() as ClassifiedLog['level'];
    const channelRaw = tagged[2]!.toLowerCase();
    const text = tagged[3] || '';
    const channel: ClassifiedLog['channel'] =
      channelRaw.includes('combat') ? 'combat'
        : channelRaw.includes('hazard') ? 'hazard'
          : channelRaw.includes('objective') || channelRaw.includes('score') ? 'objective'
            : channelRaw.includes('ai') ? 'ai'
              : 'system';
    return { idx, raw, text, level, channel };
  }

  const channel: ClassifiedLog['channel'] =
    /(attacked|killed|blast|stunned|damage|hit|healed|shield|bash|spear|fireball|jump|dash)/i.test(lower) ? 'combat'
      : /(lava|burn|hazard|void|sink|fire damage)/i.test(lower) ? 'hazard'
        : /(score|objective|floor|stairs|descending|arcade cleared)/i.test(lower) ? 'objective'
          : /(enemy|falcon|intent|telegraph|moves to|repositioning|attacks)/i.test(lower) ? 'ai'
            : 'system';

  const level: ClassifiedLog['level'] =
    /(fallen|warning|error|failed|invalid|blocked|cannot)/i.test(lower) ? 'critical'
      : /(debug|trace|telemetry|seed|counter|rng)/i.test(lower) ? 'debug'
        : /(marks the impact zone|telegraph|planning|intent)/i.test(lower) ? 'verbose'
          : 'info';

  return { idx, raw, text: msg, level, channel };
};

