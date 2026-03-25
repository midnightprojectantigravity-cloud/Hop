import type { Point } from '@hop/engine';
import type { TutorialStepId } from './tutorial-state-machine';

const MOVEMENT_SKILL_IDS = new Set(['BASIC_MOVE', 'DASH']);

export const isTutorialMovementAction = ({
  target,
  playerPosition,
  selectedSkillId,
  passiveSkillId
}: {
  target: Point;
  playerPosition: Point;
  selectedSkillId: string | null;
  passiveSkillId?: string;
}): boolean => {
  if (selectedSkillId) return false;
  if (passiveSkillId && !MOVEMENT_SKILL_IDS.has(passiveSkillId)) return false;
  return !(target.q === playerPosition.q && target.r === playerPosition.r && target.s === playerPosition.s);
};

export const isTutorialAttackAction = ({
  selectedSkillId,
  passiveSkillId
}: {
  selectedSkillId: string | null;
  passiveSkillId?: string;
}): boolean => {
  if (selectedSkillId) return !MOVEMENT_SKILL_IDS.has(selectedSkillId);
  if (passiveSkillId) return !MOVEMENT_SKILL_IDS.has(passiveSkillId);
  return false;
};

export const canSelectSkillForTutorialStep = (stepId: TutorialStepId | null, skillId: string | null): boolean => {
  if (!skillId) return true;
  if (stepId === null) return true;
  if (stepId !== 'attack') return false;
  return !MOVEMENT_SKILL_IDS.has(skillId);
};
