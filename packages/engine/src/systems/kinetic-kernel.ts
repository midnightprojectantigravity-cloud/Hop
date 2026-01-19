// src/systems/kinetic-kernel.ts

// src/systems/kinetic-kernel.ts

export type KineticEntityType = 'S' | 'M' | 'I' | 'L';

export interface KineticEntity {
    id: string;
    type: KineticEntityType;
    pos: number;
}

export interface BoardState {
    entities: KineticEntity[];
    momentum: number;
    activeId?: string;
    // isInitialPulse removed: The kernel doesn't care about timing anymore
}

export interface KineticIntention {
    finalState: KineticEntity[];
    steps: KineticEntity[][];
    activeIdAtStep: string[];
    remainingMomentum: number;
    // stunnedIds removed: The Skill Layer calculates this from remainingMomentum
}


/**
 * resolveKineticPulse
 * Generic entry point for any kinetic interaction.
 */
export function resolveKineticPulse(state: BoardState): KineticIntention {
    return processPulse(state, state.momentum, [], []);
}

/**
 * resolveKineticDash
 * Specific logic for the Dash + Slam (Hoplite style)
 */
export function resolveKineticDash(state: BoardState): KineticIntention {
    const entities = state.entities.map(e => ({ ...e }));
    const shooter = entities.find(e => e.type === 'S');

    if (!shooter) return resolveKineticPulse({ ...state, entities });

    const movables = entities.filter(e => e.type === 'M').sort((a, b) => a.pos - b.pos);
    const firstM = movables.find(m => m.pos > shooter.pos);
    if (firstM) {
        shooter.pos = firstM.pos - 1;
    }

    return resolveKineticPulse({ ...state, entities });
}

function processPulse(
    state: BoardState,
    momentum: number,
    history: KineticEntity[][],
    activeIdHistory: string[]
): KineticIntention {
    const { entities, activeId } = state;
    const currentActiveId = activeId || entities.find(e => e.type === 'S')?.id || '';

    if (momentum <= 0) {
        return { finalState: entities, steps: history, activeIdAtStep: activeIdHistory, remainingMomentum: 0 };
    }

    const activeUnit = entities.find(e => e.id === currentActiveId);
    if (!activeUnit) return { finalState: entities, steps: history, activeIdAtStep: activeIdHistory, remainingMomentum: 0 };

    const cluster = identifyCluster(entities, activeUnit);
    const cost = cluster.some(e => e.type === 'M') ? cluster.filter(e => e.type === 'M').length : 1;

    if (momentum < cost) {
        return { finalState: entities, steps: history, activeIdAtStep: activeIdHistory, remainingMomentum: momentum };
    }

    const frontUnit = cluster[cluster.length - 1];
    const collision = entities.find(e => e.type === 'I' && e.pos === frontUnit.pos + 1);

    if (collision) {
        return { finalState: entities, steps: history, activeIdAtStep: activeIdHistory, remainingMomentum: momentum };
    }

    const nextEntities = entities.map(e =>
        cluster.some(c => c.id === e.id) ? { ...e, pos: e.pos + 1 } : e
    );

    const nextActiveId = nextEntities.find(e => e.id === frontUnit.id)!.id;

    return processPulse(
        { ...state, entities: nextEntities, activeId: nextActiveId },
        momentum - cost,
        [...history, nextEntities.map(e => ({ ...e }))],
        [...activeIdHistory, nextActiveId]
    );
}

function identifyCluster(entities: KineticEntity[], activeUnit: KineticEntity): KineticEntity[] {
    const sorted = [...entities].sort((a, b) => a.pos - b.pos);
    const cluster: KineticEntity[] = [activeUnit];
    let checkPos = activeUnit.pos + 1;

    while (true) {
        const next = sorted.find(e => e.pos === checkPos && e.type === 'M');
        if (next) {
            cluster.push(next);
            checkPos++;
        } else break;
    }
    return cluster;
}

// Restore missing export for tests
export function getDisplacement(initial: KineticEntity[], final: KineticEntity[]): Map<string, number> {
    const map = new Map<string, number>();
    final.forEach(f => {
        const i = initial.find(ent => ent.id === f.id);
        if (i) map.set(f.id, f.pos - i.pos);
    });
    return map;
}