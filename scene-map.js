/* Pixel Memory World · scene data
   First step toward a real tilemap: authored world positions live in one grid-based data file.
   Coordinates are tile coordinates, not DOM percentages. */
window.PixelSceneMap={
  version:'12.1',
  outdoor:{
    cols:40,
    rows:24,
    trees:[
      [2,5,'large'],[4,4,''],[6,4,'small'],[9,3,'large'],[12,4,''],
      [2,12,''],[4,12,'small'],[6,12,'large'],[10,12,'small'],
      [22,3,''],[24,4,'small'],[27,4,'large'],[30,4,''],[32,3,'small'],[36,4,'large'],[38,3,''],
      [23,17,'large'],[26,18,''],[28,19,'small'],[31,18,'large'],[34,20,''],[37,18,'small'],
      [35,12,'large'],[38,11,''],[36,14,'small'],[29,8,'small'],[25,9,'']
    ],
    rocks:[[5,10],[10,14],[13,17],[22,7],[24,14],[28,16],[32,7],[35,16],[12,5]],
    grass:[[3,9],[5,15],[8,7],[11,10],[12,20],[22,6],[24,12],[26,7],[29,15],[31,12],[34,9],[37,16],[21,21],[7,21]],
    flowers:[[7,6],[11,18],[23,15],[27,18],[30,6],[35,17]],
    stumps:[[13,9],[32,15]],
    route:[[4,19],[7,18],[11,17],[14,16],[17,15],[21,14],[24,12],[26,11],[30,9],[33,8],[36,7]],
    reeds:[[14,6],[15,7],[15,9],[21,4],[21,6],[21,18]],
    stones:[[3,15],[6,14],[9,14],[12,13]],
    fences:[[29,17],[33,16]],
    sign:[9,16],
    cabin:true
  }
};