import { getEntityVisual, type GameState, type Actor, type InitiativeEntry } from '@hop/engine';
import { getUiActorInformation } from '../app/information-reveal';

interface InitiativeDisplayProps {
    gameState: GameState;
}

/**
 * Visualizes the turn order (Initiative Queue).
 * High priority "Juice" feature.
 */
export const InitiativeDisplay: React.FC<InitiativeDisplayProps> = ({ gameState }) => {
    const { initiativeQueue, player, enemies } = gameState;

    if (!initiativeQueue || !initiativeQueue.entries || initiativeQueue.entries.length === 0) return null;

    // Get actors in order
    const orderedActors = initiativeQueue.entries.map((entry: InitiativeEntry) => {
        if (entry.actorId === player.id) return player;
        return enemies.find(e => e.id === entry.actorId);
    }).filter((a: Actor | undefined): a is Actor => !!a);

    return (
        <div className="flex flex-col gap-2 p-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
            <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">Turn Sequence</span>
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
                {orderedActors.map((actor: Actor, idx: number) => {
                    const isPlayer = actor.id === player.id;
                    const isCurrent = idx === initiativeQueue.currentIndex;
                    const entry = initiativeQueue.entries.find(e => e.actorId === actor.id);
                    const hasActed = entry?.hasActed;
                    const actorInfo = isPlayer
                        ? null
                        : getUiActorInformation(gameState, player.id, actor.id);
                    const displayName = isPlayer
                        ? 'You'
                        : (actorInfo?.data.name || 'Unknown');
                    const displayHp = isPlayer
                        ? { current: actor.hp, max: actor.maxHp }
                        : actorInfo?.data.hp;
                    const hpPercent = displayHp
                        ? Math.max(0, Math.min(100, (displayHp.current / Math.max(1, displayHp.max)) * 100))
                        : 100;

                    return (
                        <div
                            key={`${actor.id}-${idx}`}
                            className={`flex flex-col items-center shrink-0 transition-all duration-300 ${isCurrent ? 'scale-110' : 'opacity-60 scale-90'}`}
                        >
                            {/* Actor Portrait / Icon */}
                            <div className={`
                                w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all relative
                                ${isPlayer ? 'bg-blue-500/20 border-blue-500/50' : 'bg-red-500/20 border-red-500/50'}
                                ${isCurrent ? 'shadow-[0_0_15px_rgba(255,255,255,0.2)] border-white/80' : ''}
                                ${hasActed ? 'grayscale' : ''}
                            `}>
                                <span className="text-xl">
                                    {getEntityVisual(actor.subtype, actor.type, actor.enemyType as 'melee' | 'ranged' | 'boss', actor.archetype).icon}
                                </span>

                                {isCurrent && (
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full animate-ping"></div>
                                )}

                                {hasActed && !isCurrent && (
                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center border-2 border-[#030712] text-[8px]">
                                        ✓
                                    </div>
                                )}
                            </div>

                            {/* HP bar */}
                            <div className="w-8 h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
                                <div
                                    className={`h-full ${isPlayer ? 'bg-blue-400' : (displayHp ? 'bg-red-400' : 'bg-white/35')}`}
                                    style={{ width: `${hpPercent}%` }}
                                ></div>
                            </div>

                            <span className={`text-[8px] font-bold uppercase mt-1 ${isPlayer ? 'text-blue-300' : 'text-red-300'} ${isCurrent ? 'text-white' : ''}`}>
                                {displayName}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};


