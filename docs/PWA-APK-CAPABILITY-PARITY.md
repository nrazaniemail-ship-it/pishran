# Pishran APK / PWA Capability Parity Matrix

Baseline reviewed: `main` at `ddb36c4088df5a6e24c918acf8797af7f34fcb57` (2026-11-24).
The APK and PWA use the same React module registry and module workspace implementation. Capacitor adds native filesystem/camera integrations; it does not create separate business logic for the modules.

## Twelve-module matrix

| Module | Shared module UI in APK/PWA | Dedicated functional panel in baseline | Web assessment |
|---|---|---|---|
| MOD-01 Executive dashboard | Yes | ExecutiveDashboardPanel | Shared UI; browser E2E navigation/export coverage |
| MOD-02 Cost & profitability | Yes | ModuleIntelligencePanel | Shared UI; browser E2E navigation/export coverage |
| MOD-03 Production & OEE | Yes | ModuleIntelligencePanel | Shared UI; browser E2E navigation/export coverage |
| MOD-04 KPI & performance | Yes | ModuleKpiPanel | Shared UI; browser E2E navigation/export coverage |
| MOD-05 Energy | Yes | ModuleEnergyPanel | Shared UI; bill analysis, Excel/PDF controls; gallery/camera PR #75 remains separate until merged |
| MOD-06 Maintenance & reliability | Yes | No dedicated operational panel in baseline | Generic module workspace, create/list local records and capability/benchmark content only |
| MOD-07 Process engineering | Yes | No dedicated operational panel in baseline | Generic module workspace, create/list local records and capability/benchmark content only |
| MOD-08 Supply chain & inventory | Yes | No dedicated operational panel in baseline | Generic module workspace, create/list local records and capability/benchmark content only |
| MOD-09 Market & product profitability | Yes | No dedicated operational panel in baseline | Generic module workspace, create/list local records and capability/benchmark content only |
| MOD-10 Ranking & decision intelligence | Yes | No dedicated operational panel in baseline | Generic module workspace, create/list local records and capability/benchmark content only |
| MOD-11 Project & investment management | Yes | No dedicated operational panel in baseline | Generic module workspace, create/list local records and capability/benchmark content only |
| MOD-12 Risk & resilience | Yes | No dedicated operational panel in baseline | Generic module workspace, create/list local records and capability/benchmark content only |

## Platform differences (not missing web deployment)

| Capability | Android APK | PWA / browser | Classification |
|---|---|---|---|
| Core React module screens and local project data | Shared code | Shared code | No intentional platform difference |
| XLSX export | Browser download in WebView | Browser download | Supported on both; E2E tested |
| PDF output | Print/save flow where WebView supports it | Browser print / Save as PDF | Browser/OS print capability |
| Manual JSON backup | Native download/share path | Browser download | Supported; destination is browser-controlled |
| User-selected backup directory | Native Capacitor folder plugin | File System Access API only on supporting browsers | Genuine browser API/permission limitation |
| Scheduled backup while app is closed | OS/native scheduling would be needed | Not guaranteed; page timers stop when closed | Genuine lifecycle limitation |
| Bill image acquisition | Android camera/gallery intents | Browser file chooser; camera capture depends on browser/device | Browser/device input capability; separate camera and file options are covered by PR #75 |
| Offline app shell | Packaged assets | Service worker precache and browser storage quotas | PWA/browser lifecycle and quota constraints |

## Test scope added

`npm run test:pwa-parity` runs the same Playwright test against:
1. the relative-base production preview built by CI, and
2. the published GitHub Pages PWA.

It visits all twelve modules, verifies each module's workspace and capability section, creates a local workspace in MOD-06..MOD-12, checks XLSX and print/PDF actions for every module, checks dashboard return, verifies the two-column mobile launcher and catches horizontal overflow and browser runtime errors.

The test does not claim that MOD-06..MOD-12 have dedicated domain workflows: the matrix explicitly records that product gap. Browser APIs such as persistent folder handles and background execution while closed are not treated as deploy defects.
