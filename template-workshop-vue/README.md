# Vue 3 Workshop HUD

Vue 3 + TypeScript reference HUD for Gestalt HUD SDK 0.2.

The template uses the supported Workshop `postMessage` bridge, complete snapshot replacement, all five attribute scopes, four bullet/ammo families, ES2020 output, and 1920×1080-derived root scaling.

## Install

Inside the SDK clone, `file:..` resolves the local package. SDK `0.2.0` is not currently published to npm. For a copied project, first package the SDK into that project's `vendor/` directory:

```powershell
$hud = New-Item -ItemType Directory ..\my-vue-hud -Force
Get-ChildItem .\template-workshop-vue -Force |
  Where-Object Name -NotIn @('node_modules', 'dist') |
  Copy-Item -Destination $hud.FullName -Recurse
New-Item -ItemType Directory ..\my-vue-hud\vendor -Force
npm pack --pack-destination ..\my-vue-hud\vendor
Set-Location ..\my-vue-hud
npm install .\vendor\axisray-lab-gestalt-hud-sdk-0.2.0.tgz --save-exact
npm install
npm run dev
```

Installing the tarball first replaces the copied template's `file:..` dependency with the packaged `0.2.0` artifact.

## Offline test

Run SDK DevTools on `http://localhost:8080/devtools/index.html`, then load the Vue HUD at:

```text
http://127.0.0.1:5175/index.html
```

The production HTML includes `connect-src 'none'`. Vite strips that CSP meta tag only in serve mode so local HMR can connect.

## Workshop build

```powershell
npm run typecheck
npm run build:workshop
```

Always use `build:workshop`, not plain `build`, for a release. It places `manifest.json` beside the bundled entry under `dist/`.

Validate the built directory:

```powershell
pwsh -NoProfile -File C:\path\to\gestalt-hud-sdk\scripts\validate-workshop-hud.ps1 `
  -ContentFolder .\dist
```

## Bridge state

`src/composables/useBridge.ts` exposes reactive state for:

- `battleAttributes`
- `globalAttributes`
- `playerAttributes`
- `baseAttributes`
- `playerBattleAttributes`
- init `context`

Every `hud:attribute_update` replaces all scopes. This prevents attributes/entities removed by the host from persisting in Vue state.

Manifest name/version is imported at build time; the release does not fetch it at runtime.

## Project structure

```text
src/
├── main.ts
├── App.vue
├── composables/
│   ├── useBridge.ts
│   ├── useHUDAttributes.ts
│   ├── usePlayerAttributes.ts
│   ├── useWeaponAttributes.ts
│   ├── useEnergyAttributes.ts
│   ├── useTeamAttributes.ts
│   ├── useGlobalAttributes.ts
│   ├── useModeAttributes.ts
│   └── useReviveAttributes.ts
├── components/
├── views/GameHUD.vue
├── utils/attributeAccessors.ts
└── assets/img/hud/
```

## Protocol reference

Import enums from `@axisray-lab/gestalt-hud-sdk/workshop` or the protocol-only entry. The complete generated reference is [`../docs/generated/fbs-reference.md`](../docs/generated/fbs-reference.md).

Do not copy numeric IDs or generated enum files into the project.
