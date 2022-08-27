var express = require('express');
var router = express.Router();

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database/playlist.sqlite', sqlite3.OPEN_READWRITE);
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS playlist(
    key TEXT, 
    title TEXT, 
    creator TEXT, 
    platform TEXT, 
    image TEXT, 
    songlist TEXT, 
    public TEXT, 
    clientId TEXT, 
    subscribe TEXT)`);
});

function dbAll(query) {
  return new Promise(function(resolve, reject) {
    db.all(query, [], (err, rows) => {
      if(err) resolve({'err': err});
      else resolve({'err': err, 'result': rows});
    });
  });
}

function dbRun(query) {
  return new Promise(function(resolve, reject) {
    db.run(query, (err) => {
      resolve({'err': err});
    });
  });
}

function dbGet(query) {
  return new Promise(function(resolve, reject) {
    db.get(query, (err, row) => {
      if(err) resolve({'err': err});
      else resolve({'err': err, 'result': row});
    });
  });
}

function arrToStr(arr) {
  str = '';
  for(var num = 0; num < arr.length; num++) {
    str += arr[num];
    if (num != arr.length - 1) str += '|:|';
  }

  return str
}

function createKey(key) {
  for(var num = 0; num < 3; num++) {
    type = Math.floor(Math.random() * 10) % 3;
    if (type == 0) {
        key += String.fromCharCode(Math.floor(Math.random() * (57 - 48 + 1)) + 48);
    } else if (type == 1) {
        key += String.fromCharCode(Math.floor(Math.random() * (90 - 65 + 1)) + 65);
    } else if (type == 2) {
        key += String.fromCharCode(Math.floor(Math.random() * (122 - 97 + 1)) + 97);
    }
  }

  return key;
}

function normalStatus(data={}) {
  result = {'status': 200};
  keys = Object.keys(data);
  for(var num = 0; num < keys.length; num++) {
    result[keys[num]] = data[keys[num]]
  }

  return result;
}
const wrongStatus = {'status' : 400};
const errorStatus = {'status' : 404};

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

// 플레이리스트 생성 API
router.post('/api/playlist/create', async function(req, res) {
  isStatus = null;
  title = req.body.title;
  creator = req.body.creator;
  platform = req.body.platform;
  image = req.body.image;
  songlist = arrToStr(req.body.songlist);
  public = req.body.public;
  clientId = req.body.clientId;

  await dbAll(`SELECT key FROM playlist where clientId='${clientId}'`).then((resolve) => {
    if(resolve.err) isStatus = errorStatus;
    else if(resolve.result) {
      duplicateCheck = [false];
      resolve.result.forEach((row) => {
        duplicateCheck.push(row.key);
      });

      while(true) {
        key = createKey(clientId);
        if(duplicateCheck.includes(key)) duplicateCheck[0] = true
        if(duplicateCheck[0] == false) break;
      }
    }
  });
  
  if(isStatus) return res.status(200).json(isStatus);
  
  await dbRun(`INSERT INTO playlist VALUES ('${key}', '${title}', '${creator}', '${platform}', '${image}', '${songlist}', '${public}', '${clientId}', '${clientId}')`).then((resolve) => {
    if(resolve.err) isStatus = errorStatus;
    else isStatus = normalStatus({'key' : key});
  });

  return res.status(200).json(isStatus);
});

// 플레이리스트 목록 조회 API
router.post('/api/playlist/list/:clientId', async function(req, res) {
  isStatus = null;
  clientId = req.params.clientId;

  await dbAll(`SELECT key, title, creator, platform, image FROM playlist WHERE subscribe LIKE '%${clientId}%'`).then((resolve) => {
    if(resolve.err) isStatus = errorStatus;
    else if(resolve.result != []) {
      playlistArray = [];
      resolve.result.forEach((row) => {
        playlistArray.push(row);
      });
    } else if (resolve.result == []) {
      playlistArray = null;
    }
  });

  if(isStatus) return res.status(200).json(isStatus);

  playlist = [];
  if(playlistArray) {
    for(var num = 0; num < playlistArray.length; num++) {
      playlist.push({
        'key': playlistArray[num]['key'], 
        'title': playlistArray[num]['title'],
        'creator': playlistArray[num]['creator'],
        'platform': playlistArray[num]['platform'], 
        'image': playlistArray[num]['image']});
    }
  }

  return res.status(200).json(normalStatus({'playlist': playlist}));
});

// 플레이리스트 상세 조회 API
router.post('/api/playlist/detail/:key', async function(req, res) {
  isStatus = null;
  key = req.params.key;

  await dbGet(`SELECT title, creator, platform, image, songlist, subscribe FROM playlist WHERE key='${key}'`).then((resolve) => {
    if(resolve.err) isStatus = errorStatus;
    else if(resolve.result) {
      isStatus = normalStatus({
        'title' : resolve.result['title'], 
        'creator' : resolve.result['creator'], 
        'platform' : resolve.result['platform'], 
        'image' : resolve.result['image'], 
        'songlist' : resolve.result['songlist'].split('|:|'), 
        'subscribe' : resolve.result['subscribe'].split('|:|')
      });
    } else {
      isStatus = wrongStatus;
    }
  });

  return res.status(200).json(isStatus);
});

// 플레이리스트 수정 API
router.post('/api/playlist/edit/:key', async function(req, res) {
  isStatus = null;
  key = req.params.key;
  title = req.body.title;
  image = req.body.image;
  songlist = arrToStr(req.body.songlist);
  public = req.body.public;
  clientId = req.body.clientId;

  await dbGet(`SELECT * FROM playlist WHERE key='${key}'`).then((resolve) => {
    if(resolve.err) isStatus = errorStatus;
    else if(resolve.result) {
      if(resolve.result['clientId'] != clientId) isStatus = wrongStatus;
    } else return isStatus = wrongStatus;
  });

  if(isStatus) return res.status(200).json(isStatus);

  await dbRun(`UPDATE playlist SET title = '${title}', image = '${image}', songlist = '${songlist}', public = '${public}' WHERE key = '${key}'`).then((resolve) => {
    if(resolve.err) isStatus = errorStatus;
    else isStatus = normalStatus();
  });

  return res.status(200).json(isStatus);
});

// 플레이리스트 삭제 API
router.post('/api/playlist/delete/:key', async function(req, res) {
  isStatus = null;
  key = req.params.key;
  clientId = req.body.clientId;

  await dbGet(`SELECT * FROM playlist WHERE key='${key}'`).then((resolve) => {
    if(resolve.err) isStatus = errorStatus;
    else if(resolve.result) {
      if(resolve.result['clientId'] != clientId) isStatus = wrongStatus;
    } else isStatus = wrongStatus;
  });

  if(isStatus) return res.status(200).json(isStatus);

  await dbRun(`DELETE FROM playlist WHERE key = '${key}'`).then((resolve) => {
    if(resolve.err) isStatus = errorStatus;
    else isStatus = normalStatus();
  });

  return res.status(200).json(isStatus);
});

// 공유된 플레이리스트 추가
router.post('/api/playlist/add/:key', async function(req, res) {
  isStatus = null;
  key = req.params.key;
  clientId = req.body.clientId;
  
  await dbRun(`UPDATE playlist SET subscribe = subscribe || '|:|${clientId}' WHERE key = '${key}'`).then((resolve) => {
    if(resolve.err) isStatus = errorStatus;
    else isStatus = normalStatus();
  });

  return res.status(200).json(isStatus);
});

// 공유된 플레이리스트 삭제
router.post('/api/playlist/remove/:key', async function(req, res) {
  isStatus = null;
  key = req.params.key;
  clientId = req.body.clientId;

  await dbGet(`SELECT * FROM playlist WHERE key = '${key}' AND subscribe LIKE '%|:|${clientId}%'`).then((resolve) => {
    if(resolve.err) isStatus = errorStatus;
    else if(resolve.result) {
      subscribe = resolve.result['subscribe'];
    } else isStatus = wrongStatus;
  });

  if(isStatus) return res.status(200).json(isStatus);

  await dbRun(`UPDATE playlist SET subscribe = '${subscribe.replace(`|:|${clientId}`, '')}' WHERE key = '${key}'`).then((resolve) => {
    if(resolve.err) isStatus = errorStatus;
    else isStatus = normalStatus();
  });

  return res.status(200).json(isStatus);
});

module.exports = router;
