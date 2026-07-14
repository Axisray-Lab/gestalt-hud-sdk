import {
  WORKSHOP_MANIFEST_SCHEMA_VERSION,
  CAPABILITY_BIT_HUD,
  MAP_ID_TO_NAME,
  checkRequiredMods,
  isHUDInitMessage,
  validateManifest,
  type WorkshopModManifest,
} from '@axisray-lab/gestalt-hud-sdk/protocol';
import {
  GestaltHUDBridge,
  type HUDDebugLogMessage,
} from '@axisray-lab/gestalt-hud-sdk/workshop';
import {
  AttributeStore,
  HUDBridge,
  TrustedWebSocketMethod,
} from '@axisray-lab/gestalt-hud-sdk';

const manifest: WorkshopModManifest = {
  sdk_version: WORKSHOP_MANIFEST_SCHEMA_VERSION,
  name: 'Type consumer',
  version: '1.0.0',
  author: 'SDK test',
  description: 'Compile-only public entry-point coverage',
  provides: ['hud'],
};

validateManifest(manifest);
checkRequiredMods(2, [], 2, []);
isHUDInitMessage({});
void CAPABILITY_BIT_HUD;
void MAP_ID_TO_NAME;
void GestaltHUDBridge;
void AttributeStore;
void HUDBridge;
void TrustedWebSocketMethod;
void (null as HUDDebugLogMessage | null);
