// Load the neighborhood boundaries
var neighborhoods = ee.FeatureCollection('projects/ee-sinanansen/assets/ist_mahalle');
var canopyHeight = ee.ImageCollection('projects/meta-forest-monitoring-okw37/assets/CanopyHeight').mosaic();

// Add a property for the total area of each neighborhood
var neighborhoodsWithArea = neighborhoods.map(function(feature) {
  return feature.set('total_area', feature.geometry().area());
});

// Calculate pixel areas
var treenotree = canopyHeight.gte(1);
var treenotreeArea = treenotree.multiply(ee.Image.pixelArea());

// Reduce the treenotreeArea image to neighborhood statistics
var stats = treenotreeArea.reduceRegions({
  collection: neighborhoodsWithArea,
  reducer: ee.Reducer.sum(),
  scale: 10
});

// Compute the percentage of canopy pixels for each neighborhood
var statsWithPercentage = stats.map(function(feature) {
  var canopyArea = ee.Number(feature.get('sum'));
  var totalArea = ee.Number(feature.get('total_area'));
  var canopyPercentage = canopyArea.divide(totalArea).multiply(100);
  return feature.set({
    'canopy_area': canopyArea,
    'canopy_percentage': canopyPercentage
  });
});

// Create visualization parameters
var visParams = {
  min: 0,
  max: 50,  // Adjust this based on your maximum percentage
  palette: ['#fee5d9', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#99000d']
};

// Empty image to fill with colors
var empty = ee.Image().byte();

// Paint the features with the canopy percentage
var filled = empty.paint({
  featureCollection: statsWithPercentage,
  color: 'canopy_percentage'
});

// Add layers to map
Map.addLayer(filled.clip(neighborhoods), visParams, 'Canopy Coverage (%)');

// Add a legend
// Create the panel
var legend = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '8px 15px'
  }
});

// Create legend title
var legendTitle = ui.Label({
  value: 'Canopy Coverage (%)',
  style: {
    fontWeight: 'bold',
    fontSize: '16px',
    margin: '0 0 4px 0',
    padding: '0'
  }
});

legend.add(legendTitle);

// Create color scale
var colors = ['#fee5d9', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#99000d'];
var steps = [0, 8, 16, 24, 32, 40, 50];

steps.forEach(function(step, index) {
  var colorBox = ui.Label({
    style: {
      backgroundColor: colors[index],
      padding: '8px',
      margin: '0 0 4px 0'
    }
  });
  
  var valueLabel = ui.Label({
    value: step.toString() + '%',
    style: {margin: '0 0 4px 6px'}
  });
  
  var entry = ui.Panel({
    widgets: [colorBox, valueLabel],
    layout: ui.Panel.Layout.Flow('horizontal')
  });
  
  legend.add(entry);
});

Map.add(legend);

// Center map on the area of interest
Map.centerObject(neighborhoods, 11);

// Export the results as a table
Export.table.toDrive({
  collection: statsWithPercentage,
  description: 'CanopyPercentagePerNeighborhood',
  fileFormat: 'JSON'
});