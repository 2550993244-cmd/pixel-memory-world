/* Pixel Memory World · V15 authored scene data
   Backward-compatible legacy arrays + explicit layered map contract.
   Legacy arrays remain because V12/V14 scenery still reads them directly. */
window.PixelSceneMap={
  version:'15.0',
  outdoor:{
    cols:40,
    rows:24,
    world:{
      width:1600,
      height:960,
      viewportScale:1.24,
      tileSize:40,
      cols:40,
      rows:24
    },

    /* P1 layer contract. Coordinates in these layers are normalized percentages
       unless a tile array is explicitly documented. */
    layers:{
      ground:{
        id:'ground',
        kind:'terrain',
        fill:'meadow',
        grid:{cols:40,rows:24,tileSize:40}
      },
      path:{
        id:'path',
        kind:'route',
        points:[[10,80],[18,77],[27,73],[35,68],[43,63],[52,58],[59,51],[66,44],[74,38],[82,34],[89,31]]
      },
      objects:{
        id:'objects',
        kind:'props',
        fishing:{x:30,y:44},
        bridge:{x:45,y:58},
        returnDoor:{x:7,y:84}
      },
      collision:{
        id:'collision',
        kind:'collision',
        ellipses:[
          {x:19,y:32,rx:12,ry:13,id:'pond'},
          {x:41,y:29,rx:9,ry:9,id:'hill-west'},
          {x:83,y:26,rx:10,ry:10,id:'hill-east'}
        ],
        bounds:{left:3.5,right:96.5,top:8,bottom:93}
      },
      foreground:{
        id:'foreground',
        kind:'depth',
        canopy:true,
        ySort:true
      }
    },

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
    cabin:true
  },

  room:{
    version:1,
    editableObjects:{
      notes:{selector:'.room-note-wall',x:14,y:23,label:'留言墙'},
      photos:{selector:'.room-photo-wall',x:82,y:24,label:'照片墙'},
      cake:{selector:'.room-cake-table',x:50,y:48,label:'蛋糕桌'},
      gifts:{selector:'.room-gift-corner',x:82,y:57,label:'礼物角'},
      music:{selector:'.room-record-player',x:32,y:24,label:'唱片机'},
      sofa:{selector:'.room-sofa',x:18,y:57,label:'沙发'},
      plant:{selector:'.room-plant',x:91,y:78,label:'绿植'}
    }
  }
};
