export const getEntityComponent = <T>(components: unknown, componentId: string): T | undefined => {
  if (!components) return undefined;

  if (components instanceof Map) {
    return components.get(componentId) as T | undefined;
  }

  if (Array.isArray(components)) {
    const entry = components.find(
      (candidate): candidate is [string, T] =>
        Array.isArray(candidate) && candidate[0] === componentId
    );
    return entry?.[1];
  }

  if (typeof components === 'object') {
    const mapLike = components as { get?: (key: string) => unknown };
    if (typeof mapLike.get === 'function') {
      return mapLike.get(componentId) as T | undefined;
    }

    return (components as Record<string, T | undefined>)[componentId];
  }

  return undefined;
};
