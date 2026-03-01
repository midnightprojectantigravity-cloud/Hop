import { useEffect, useRef, useState } from 'react';
import type { Actor as EntityType } from '@hop/engine';

interface UseEntityVisualStateArgs {
  entity: EntityType;
  assetHref?: string;
  fallbackAssetHref?: string;
}

interface UseEntityVisualStateResult {
  resolvedAssetHref?: string;
  handleAssetError: () => void;
  isFlashing: boolean;
}

export const useEntityVisualState = (
  args: UseEntityVisualStateArgs
): UseEntityVisualStateResult => {
  const { entity, assetHref, fallbackAssetHref } = args;

  const [resolvedAssetHref, setResolvedAssetHref] = useState<string | undefined>(assetHref || fallbackAssetHref);
  const [usedFallbackAsset, setUsedFallbackAsset] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const prevHp = useRef(entity.hp);

  useEffect(() => {
    setResolvedAssetHref(assetHref || fallbackAssetHref);
    setUsedFallbackAsset(false);
  }, [assetHref, fallbackAssetHref, entity.id]);

  const handleAssetError = () => {
    if (!usedFallbackAsset && fallbackAssetHref && resolvedAssetHref !== fallbackAssetHref) {
      setResolvedAssetHref(fallbackAssetHref);
      setUsedFallbackAsset(true);
      return;
    }
    setResolvedAssetHref(undefined);
  };

  useEffect(() => {
    if (entity.hp < prevHp.current) {
      setIsFlashing(true);
      const timer = setTimeout(() => setIsFlashing(false), 150);
      return () => clearTimeout(timer);
    }
    prevHp.current = entity.hp;
  }, [entity.hp]);

  return {
    resolvedAssetHref,
    handleAssetError,
    isFlashing
  };
};
