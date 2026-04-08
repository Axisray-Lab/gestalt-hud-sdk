/**
 * Attribute accessor factory functions.
 * Provides a uniform pattern for reading numeric attribute maps
 * as typed Vue computed refs.
 *
 * Adapted from the game's internal UI utilities — open-sourced
 * as part of the Gestalt HUD SDK.
 */

import type { Ref, ComputedRef } from 'vue';
import { computed } from 'vue';
import { ERobotBridgeDemoAttributeId } from '@axisray-lab/gestalt-hud-sdk/workshop';

type AttributeMap = Record<string, number>;

export function createNumberGetter(
  attributes: Ref<AttributeMap> | ComputedRef<AttributeMap>,
  attributeId: ERobotBridgeDemoAttributeId,
  defaultValue: number = 0,
): ComputedRef<number> {
  return computed(() => {
    const key = String(attributeId);
    const val = attributes.value?.[key];
    return Number.isFinite(val) ? Number(val) : defaultValue;
  });
}

export function createBooleanGetter(
  attributes: Ref<AttributeMap> | ComputedRef<AttributeMap>,
  attributeId: ERobotBridgeDemoAttributeId,
): ComputedRef<boolean> {
  return computed(() => {
    const key = String(attributeId);
    const val = attributes.value?.[key];
    return Number(val) === 1;
  });
}

export function createEnumGetter<T = number>(
  attributes: Ref<AttributeMap> | ComputedRef<AttributeMap>,
  attributeId: ERobotBridgeDemoAttributeId,
  defaultValue: T = 0 as T,
): ComputedRef<T> {
  return computed(() => {
    const key = String(attributeId);
    const val = attributes.value?.[key];
    return (Number.isFinite(val) ? Number(val) : defaultValue) as T;
  });
}

export function createTransformedGetter<T>(
  attributes: Ref<AttributeMap> | ComputedRef<AttributeMap>,
  attributeId: ERobotBridgeDemoAttributeId,
  transform: (value: number) => T,
  defaultValue: T,
): ComputedRef<T> {
  return computed(() => {
    const key = String(attributeId);
    const val = attributes.value?.[key];
    if (!Number.isFinite(val)) return defaultValue;
    return transform(Number(val));
  });
}
