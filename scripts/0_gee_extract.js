// ============================================================
// 0_gee_extract.js
// San Martín, Peru: forest loss, farmland greenness and climate, 2001–2024
//
// What this script does:
// It builds two tables, one row per province per year.
//   1) SM_loss_by_unit_year.csv       how much forest each province lost each year
//   2) SM_condition_by_unit_year.csv  how green the old farmland was, how much it rained,
//                                     and how dry the year was
// Both tables go to my Google Drive, in a folder called "san_martin_cocoa_clearing".
//
// How to run it:
// Paste into the Earth Engine Code Editor, press Run,
// then open the Tasks tab and press Run on both exports.
//
// Note: AI wrote this code with me, based on my design. I ran it, checked the results, and wrote the comments.
// ============================================================


// ---------- 0. The study units: the 10 provinces of San Martín ----------
// Earth Engine already has a map of provinces (FAO GAUL 2015, level 2).
// I keep only the provinces inside the San Martín region.
// The console should say 10. If not, something is wrong.
var units = ee.FeatureCollection('FAO/GAUL/2015/level2')
  .filter(ee.Filter.stringContains('ADM1_NAME', 'San Mart'));
print('Units found (expect 10 provinces):', units.size());
print('Unit names:', units.aggregate_array('ADM2_NAME'));
Map.centerObject(units, 7);
Map.addLayer(units.style({color: 'ffffff', fillColor: '00000000', width: 1}), {}, 'provinces');

// The years I want: 2001 to 2024.
var years = ee.List.sequence(2001, 2024);


// ---------- 1. Forest in 2000 and the year it was lost (Hansen) ----------
// Hansen gives two things I need:
//   - tree cover in 2000, in percent. I call it "forest" when it is 30% or more.
//   - the year each pixel lost its trees. 1 means 2001, 24 means 2024.
// pixelArea gives the size of each pixel in m2. I divide by 10,000 to get hectares.
var gfc = ee.Image('UMD/hansen/global_forest_change_2024_v1_12');
var forest2000 = gfc.select('treecover2000').gte(30);
var lossyear   = gfc.select('lossyear');
var pixelHa    = ee.Image.pixelArea().divide(10000);


// ---------- 2. Where is the old, stable farmland? (MODIS land cover) ----------
// I only want to measure greenness on land that has been farmed for a long time.
// Not on new clearings, and not on forest.
// MODIS gives a land cover map every year, 2001 to 2023, at 500 m.
// Class 12 = cropland. Class 14 = cropland mixed with natural vegetation.
// For each pixel I count in how many years it was farmland.
// If it was farmland in at least 80% of the years, I call it "stable farmland".

var lc = ee.ImageCollection('MODIS/061/MCD12Q1').select('LC_Type1')
  .filterDate('2001-01-01', '2023-12-31');
var isFarm   = lc.map(function (img) { return img.eq(12).or(img.eq(14)); });
var farmFreq = isFarm.sum().divide(isFarm.count());
var farmMask250 = farmFreq.gte(0.8);
Map.addLayer(farmMask250.selfMask(), {palette: ['orange']}, 'stable farmland (MODIS LC)', false);


// ---------- 3. Greenness of that farmland (MODIS EVI) ----------
// EVI tells me how green the vegetation is. Higher means healthier crops.
// MODIS gives one EVI image every 16 days, at 250 m.
// For each image I do three things:
//   - keep only good-quality pixels (no clouds, no errors)
//   - multiply by 0.0001, because MODIS stores EVI as whole numbers to save space
//   - keep only pixels on stable farmland (from step 2)
var evi = ee.ImageCollection('MODIS/061/MOD13Q1')
  .filterDate('2001-01-01', '2024-12-31')
  .map(function (img) {
    var good = img.select('SummaryQA').eq(0);
    return img.select('EVI').multiply(0.0001)
      .updateMask(good).updateMask(farmMask250)
      .copyProperties(img, ['system:time_start']);
  });


// ---------- 4. Climate: rain and drought (TerraClimate) ----------
// TerraClimate gives one image per month, for the whole world.
// I use two bands: rainfall (pr) and the drought index (pdsi).
var tc = ee.ImageCollection('IDAHO_EPSCOR/TERRACLIMATE');


// ---------- 5a. Forest loss: hectares per province per year ----------
// For each year:
//   - find the pixels that were forest in 2000 AND lost their trees that year
//   - give each pixel its area in hectares
//   - add up the hectares inside each province
// Then I put all 24 years together into one table.
function lossRow(y) {
  y = ee.Number(y);
  var img = lossyear.eq(y.subtract(2000)).and(forest2000)
    .multiply(pixelHa).rename('loss_ha');
  return img.reduceRegions({
      collection: units,
      reducer: ee.Reducer.sum().setOutputs(['loss_ha']),
      scale: 30
    }).map(function (f) { return f.set('year', y); });
}
var lossTable = ee.FeatureCollection(years.map(lossRow)).flatten();


// ---------- 5b. Farmland condition and climate: averages per province per year ----------
// For each year, I compute six numbers per province:
//   evi_dry    average greenness in the dry season (June to September)
//              The dry season is when a bad year shows most.
//   evi_dry_n  how many clear images went into evi_dry (8 at most)
//              If this is low, evi_dry is less reliable.
//   evi_year   average greenness over the whole year
//   rain_mm    total rain in the year, in millimetres (sum of the 12 months)
//   pdsi       average drought index for the year. Below 0 = drier than normal.
//              TerraClimate stores it ×100, so I multiply by 0.01.
//   farm_share share of the province that is stable farmland (0 to 1)
// Then I put all 24 years together into one table.
function condRow(y) {
  y = ee.Number(y);
  var inYear = evi.filter(ee.Filter.calendarRange(y, y, 'year'));
  var dry    = inYear.filter(ee.Filter.calendarRange(6, 9, 'month'));
  var clim   = tc.filter(ee.Filter.calendarRange(y, y, 'year'));
  var img = dry.mean().rename('evi_dry')
    .addBands(dry.count().rename('evi_dry_n'))
    .addBands(inYear.mean().rename('evi_year'))
    .addBands(clim.select('pr').sum().rename('rain_mm'))
    .addBands(clim.select('pdsi').mean().multiply(0.01).rename('pdsi'))
    .addBands(farmMask250.unmask(0).rename('farm_share'));
  return img.reduceRegions({
      collection: units,
      reducer: ee.Reducer.mean(),
      scale: 250
    }).map(function (f) { return f.set('year', y); });
}
var condTable = ee.FeatureCollection(years.map(condRow)).flatten();


// ---------- 6. Save both tables to Google Drive ----------
// After Run, go to the Tasks tab and press RUN on both.
// The loss table is slow (30 m pixels, 24 years). 10 to 40 minutes is normal.
// Each table should have 240 rows: 10 provinces × 24 years.
Export.table.toDrive({
  collection: lossTable,
  description: 'SM_loss_by_unit_year',
  folder: 'san_martin_cocoa_clearing',
  fileFormat: 'CSV',
  selectors: ['ADM2_NAME', 'year', 'loss_ha']
});
Export.table.toDrive({
  collection: condTable,
  description: 'SM_condition_by_unit_year',
  folder: 'san_martin_cocoa_clearing',
  fileFormat: 'CSV',
  selectors: ['ADM2_NAME', 'year', 'evi_dry', 'evi_dry_n', 'evi_year', 'rain_mm', 'pdsi', 'farm_share']
});
