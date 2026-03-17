export const RUN_LOST_OVERLAY_PLAYER_DEATH_DELAY_MS = 720;

export const resolveRunLostOverlayVisible = ({
    gameStatus,
    playerHp,
    isBusy,
    delayElapsed,
}: {
    gameStatus: string;
    playerHp: number;
    isBusy: boolean;
    delayElapsed: boolean;
}): boolean => (
    gameStatus === 'lost'
    && !isBusy
    && (playerHp > 0 || delayElapsed)
);
