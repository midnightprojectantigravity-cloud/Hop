import { describe, expect, it } from 'vitest';
import { classifyMessage } from '../components/ui/ui-log-classifier';

describe('ui log classifier', () => {
  it('parses explicit tagged level/channel prefixes', () => {
    const parsed = classifyMessage('[DEBUG|COMBAT_AI] planning blast', 3);
    expect(parsed.level).toBe('debug');
    expect(parsed.channel).toBe('combat');
    expect(parsed.text).toBe('planning blast');
  });

  it('infers level/channel from untagged messages', () => {
    const inferred = classifyMessage('Warning: blocked by lava hazard near stairs', 9);
    expect(inferred.channel).toBe('hazard');
    expect(inferred.level).toBe('critical');
  });
});
