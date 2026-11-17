# Do bad years on farmland push clearing into the forest?

**Crop condition, drought and forest loss in San Martín, Peru (2001–2024)**

Capstone project for the Yale Environmental Data Science (EDS) online certificate.
Status: work in progress.

---

## About the project

San Martín is a region in the Peruvian Amazon. Cocoa and coffee are grown there, and the region has lost a lot of forest in the last 20 years.

Farmers do not clear forest at random. One idea is that clearing goes up after a **bad year** on the land they already farm: crops look poor, it is dry, or prices are low. If that is true, helping farmers get through bad years on existing farmland could also help protect the forest.

This project looks at that idea with open satellite and climate data.

## Research question

**Are bad years on existing farmland (poor crop condition, drought) followed by more forest loss the next year?**

Smaller questions I want to answer:
1. Which kind of bad year matters most: poor crop condition, drought, or low prices?
2. How long is the delay between a bad year and more clearing?
3. Which places react the most, and why?
4. What should be monitored to see this coming?

Important: this project looks for **patterns in time** (what happens first, what happens after). It does not prove cause and effect.

## Study area and period

- **Area:** San Martín region, Peru. For now, the 10 provinces. Later, the districts.
- **Period:** 2001 to 2024, one value per year.
- **Unit of analysis:** one row = one province in one year (10 provinces × 24 years = 240 rows).

## Datasets

All data is open and free. I processed it in Google Earth Engine with `scripts/0_gee_extract.js`.

| Dataset | What I use it for | Resolution | Source |
|---|---|---|---|
| Hansen Global Forest Change v1.12 | Forest in 2000 (≥30% tree cover) and the year it was lost | 30 m | [Earth Engine catalog](https://developers.google.com/earth-engine/datasets/catalog/UMD_hansen_global_forest_change_2024_v1_12) |
| MODIS Land Cover (MCD12Q1) | Finding "stable farmland": land farmed in at least 80% of the years | 500 m | [Earth Engine catalog](https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MCD12Q1) |
| MODIS Vegetation Index (MOD13Q1, EVI) | Crop greenness on stable farmland, as a sign of a good or bad year | 250 m, every 16 days | [Earth Engine catalog](https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MOD13Q1) |
| TerraClimate | Yearly rainfall and drought index (PDSI) | ~4 km, monthly | [Earth Engine catalog](https://developers.google.com/earth-engine/datasets/catalog/IDAHO_EPSCOR_TERRACLIMATE) |
| FAO GAUL 2015, level 2 | Province boundaries | vector | [Earth Engine catalog](https://developers.google.com/earth-engine/datasets/catalog/FAO_GAUL_2015_level2) |

Planned for later: world cocoa and coffee prices (World Bank), district boundaries, and official crop yields to check the greenness data.

## What is in this repository

```
san_martin_cocoa_clearing/
├── raw_data/       Original tables from Earth Engine. Never changed.
├── clean_data/     Tables made by the cleaning script.
├── figures/        Charts made by the analysis scripts (coming soon).
├── scripts/        All code, numbered in the order it runs.
├── README.md       This file.
└── LICENSE         MIT licence.
```

### raw_data/

| File | What it holds |
|---|---|
| `SM_loss_by_unit_year.csv` | Forest loss in hectares, per province per year |
| `SM_condition_by_unit_year.csv` | Greenness, rain, drought and farmland share, per province per year |

### scripts/

| Script | What it does |
|---|---|
| `0_gee_extract.js` | Runs in Google Earth Engine. Builds the two raw tables from the satellite and climate data. |
| `1_data_clean.ipynb` | Runs in Google Colab (R). Reads the two raw tables, cleans them, checks them, joins them, and saves one clean table. |

### clean_data/

`sm_province_year_clean.csv` has one row per province per year (240 rows):

| Column | Meaning | Unit |
|---|---|---|
| `province` | Province name | text |
| `year` | Year | 2001–2024 |
| `loss_ha` | Forest lost that year | hectares |
| `evi_dry` | Average crop greenness in the dry season (June–September) | index, 0 to 1 |
| `evi_dry_n` | Number of clear images behind `evi_dry` (max 8) | count |
| `evi_year` | Average crop greenness over the whole year | index, 0 to 1 |
| `rain_mm` | Total rainfall in the year | mm |
| `pdsi` | Drought index. Below 0 = drier than normal | index |
| `farm_share` | Share of the province that is stable farmland | 0 to 1 |
| `evi_missing` | TRUE if there is no greenness value for that row | TRUE / FALSE |

## How to run it

1. **Get the raw data (optional).** The raw tables are already in `raw_data/`. To make them again, paste `scripts/0_gee_extract.js` into the [Earth Engine Code Editor](https://code.earthengine.google.com/), press Run, and run both exports in the Tasks tab. Then move the two CSV files into `raw_data/`.
2. **Clean the data.** Put this project folder in Google Drive. Open `scripts/1_data_clean.ipynb` in Google Colab.
   - Run Step 0 with a **Python** runtime (it connects Google Drive).
   - Switch to an **R** runtime and run the other steps in order.
   - The clean table is saved in `clean_data/`.

R packages used: `readr`, `dplyr`.

## Known limitations (so far)

- **Provinces, not districts.** For now the data is at province level (10 units). I plan to move to districts for more detail.
- **Two provinces have no greenness.** El Dorado and Mariscal Cáceres have no "stable farmland" in the MODIS land cover map (500 m is coarse), so there is no greenness value. Their rows are kept and flagged with `evi_missing`.
- **Greenness is not yield.** EVI shows how green the crops are, not how many tonnes were harvested. I plan to check it against official yield data.
- **Hansen counts all tree cover.** It includes secondary forest and old plantations, so its numbers are higher than official figures for primary forest. There is also a known jump in 2012 in this region.
- **Patterns, not proof.** Results will show what tends to happen after a bad year, not that the bad year caused the clearing.

## Use of AI

I used AI (Claude) as a coding assistant. The cleaning script uses the methods taught in this certificate, following the structure of the course practice sets. AI helped me draft the code. I ran it step by step, checked every result, and drafted the explanations. The Earth Engine script was written with AI help. My previous experience with JavaScript in Google Earth Engine helped me run it and check the results.

## Licence

Code is under the MIT licence (see `LICENSE`). The datasets keep their own licences; see the links in the Datasets section.
