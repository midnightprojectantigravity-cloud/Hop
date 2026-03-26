import type { ArmorBurdenTier, WeightClass } from '../../types';
import type { TrinityStats } from '../../systems/combat/trinity-resolver';

export interface EphemeralActorContract {
    subtype: 'bomb';
    actorClass: 'ephemeral_hazard_actor';
    weightClass: WeightClass;
    armorBurdenTier: ArmorBurdenTier;
    trinity: TrinityStats;
    speed: number;
    fuseTurns: number;
    blastRadius: number;
}

export const BOMB_ACTOR_CONTRACT: EphemeralActorContract = {
    subtype: 'bomb',
    actorClass: 'ephemeral_hazard_actor',
    weightClass: 'Light',
    armorBurdenTier: 'None',
    trinity: { body: 0, mind: 0, instinct: 0 },
    speed: 1,
    fuseTurns: 2,
    blastRadius: 1
};
