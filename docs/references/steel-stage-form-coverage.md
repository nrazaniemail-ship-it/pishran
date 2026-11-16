# Steel-chain feasibility form coverage

This document records the stage-specific input structure currently wired into the feasibility wizard. A row definition is not a validated engineering assumption: numeric values remain blank/zero until a project source, vendor quotation or engineering basis is entered.

## Template rules

- The raw template starts with empty product, technical, material-balance, utility, CAPEX and OPEX row collections. It does not inherit hot-rolling defaults.
- The project type selected during project creation is the single source of truth for stage-specific forms. The wizard does not expose a second steel-chain-stage selector that could disagree with the selected project type.
- Project creation asks for the project type first and a manually entered project name second. Non-steel industries use the same separate type/name pattern.
- Steel/mining capacity is entered as numeric tonnes per year; energy and power capacity is numeric MW; other industries use a generic unit/year label.
- The `سایر` project type intentionally remains empty and requires user-defined rows.
- The hot-rolled coil template remains the only stage with the HRCR200 workbook-derived values preloaded.
- Cold rolling retains the supplied report's CAPEX items and the known hot-coil feedstock row; unavailable energy and OPEX values remain zero and visibly require engineering completion.

## Stage-specific form directories

| Stage | Material balance / process inputs | Utilities | CAPEX | OPEX |
|---|---|---|---|---|
| Iron-ore mining | ROM feed, waste, explosives, diesel, drilling parts | drilling/crushing electricity, diesel, mine water, compressed air | drilling/blasting, haulage, loading, crushing, conveyors, dewatering, workshop | extraction/haulage, fuel, spares, labour, safety/environment |
| Concentration | ore feed, grinding media, reagents, flocculants, lime, concentrate/tailings | electricity, process water, gas, diesel, compressed air | crushing, milling, separation/flotation, thickener/filter, water recovery, lab | ore, wear parts, chemicals, utilities, labour, maintenance, tailings |
| Pelletizing | concentrate, bentonite, fluxes, additives, pellets and recycle fines | furnace gas, electricity, water, compressed air | mixing, balling discs/drums, drying/preheat, induration, cooling, screening, dust collection | concentrate, binders, fuel/power, refractories, labour, maintenance |
| Direct reduction | pellets, lime/dolomite fines, catalyst/tubes, oil, grease, CDRI and recycle | reduction/reformer gas, electricity, water/cooling, oxygen, compressed air, nitrogen | pellet handling, shaft furnace, reformer/gas system, compressors, cooling/dedusting, DRI handling, utilities, buildings/installation | pellets, lime/dolomite, gas, power/water, catalyst/refractory, consumables, labour/overhead, maintenance |
| Steelmaking & casting | DRI, scrap, fluxes, alloys/carbon, electrodes, refractories, steel yield, slag | electricity, gas, oxygen, cooling water, argon/nitrogen, compressed air | EAF/IF, charging, LF/secondary metallurgy, gas cleaning, continuous caster, cutting/cooling, utilities | metallic charge, alloys, electrodes/refractories, utilities, labour, maintenance, lab/overhead |
| Integrated DRI + slab | pellets, DRI, scrap, alloys, electrodes, slab and surplus DRI | DRI gas/power, steelmaking power, oxygen, water, industrial gases | DRI/reformer, EAF, LF, slab caster, gas cleaning, utilities, material handling | pellets, scrap/alloys, DRI energy, steelmaking utilities, electrodes/refractories, labour, maintenance |
| Hot-rolled plate | slab, furnace fuel, rolls, cooling water, crop/scale, plate yield | furnace gas, rolling electricity, cooling water, oxygen/air | reheating, descaling, roughing/finishing stands, cooling table, shears, levelling, utilities | slab, fuel/power, rolls/consumables, labour, maintenance, packing/freight |
| Hot-rolled coil | workbook-backed HRCR200 material, utility, CAPEX and OPEX rows | workbook-backed HRCR200 rows | workbook-backed HRCR200 rows | workbook-backed HRCR200 rows |
| Cold rolling | hot-coil feed, pickling acid, rolling oil, coating chemicals, scrap/yield | electricity, annealing gas, water, compressed air/nitrogen | retained source-report CAPEX schedule | source labels retained; monetary/energy assumptions remain to be completed |
| Rebar / angle / beam rolling | billet/bloom, furnace fuel, rolls, scrap/yield, product dimensions | gas, rolling electricity, cooling water, compressed air | reheating, stands, cutting, cooling, straightening, packing, utilities | billet, fuel/power, rolls/consumables, labour, maintenance, packing/freight |

## Direct-reduction source boundary

The library contains the Ramhormoz direct-reduction feasibility report FS1023-v.2 (June 2022 / Mehr 1401). It describes a 1.0 Mt/y MIDREX cold-DRI plant. Its technical pages include pellet specifications and consumption, lime/dolomite, catalyst/tubes, oil/grease, water, natural gas and electricity; later pages include ramp-up, CAPEX categories, operating costs, working capital, sales and a financing schedule.

Those values are project- and date-specific. They are not silently copied into every DRI project. The current DRI directory is a structured input form; the Ramhormoz report remains a reference source for a separately identified DRI project or for explicit user-approved benchmarking. The separate DRI/steelmaking Excel audit is also not a default for a standalone DRI plant.

## Remaining validation before calling forms complete

1. Map the user's original stage-specific CAPEX/OPEX spreadsheets to the row IDs and units above, preserving source references and currencies.
2. Verify material balance closure, product yield, utility intensity and annual cost totals against the source workbooks.
3. Connect stage-specific rows to the periodic finance engine without double counting materials or utilities already transferred from the process balance.
4. Complete market assumptions, product pricing, ramp-up, depreciation asset classes and working-capital cycles for each stage.
5. Run save/reopen/edit tests for raw, specialized and non-steel projects; no sample project is considered validated merely because its form renders.
