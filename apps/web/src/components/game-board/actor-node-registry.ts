export type RegisteredActorNodes = {
  actor: SVGGElement | null;
  motion: SVGGElement | null;
  pad: SVGGElement | null;
};

export type RegisterActorNodes = (actorId: string, nodes: RegisteredActorNodes | null) => void;
