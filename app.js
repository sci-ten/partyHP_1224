const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
let router = express.Router();


app.engine('html', require('ejs').renderFile);

app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());
app.use(express.static('public'));


/*********************/
/*ユーザ情報の読み込み*/
/*********************/
let user_data = JSON.parse(fs.readFileSync('./data/member.json', 'utf8'))["users"];


/********************/
/*セッション設定*****/
/********************/
const sess = {
  secret: 'secretsecretsecret',
  cookie: {
    maxAge: 60000
  },
  resave: false,
  saveUninitialized: false,
}
app.use(session(sess));


/********************/
/*ルーティング処理****/
/********************/

app.get('/', (req, res) => {
  res.render('home.html');
});

app.get('/login', (req, res) => {
  res.render('login.html', {
    item: req.session.username
  });
});

app.get('/logout', (req, res) => {
  console.log("logOUT", req.session.username)
  req.session.destroy((err) => {
    res.redirect('/');
  });
});

app.post('/login', (req, res) => {
  const auth = login_authentication(req.body.username, req.body.password)
  if (auth) {
    req.session.regenerate((err) => {
      req.session.username = req.body.username;
      console.log("login", req.session.username);
      res.redirect('/roulette');
    });
  } else {
    res.redirect('/login');
  }

});


app.get('/roulette', (req, res) => {
  if (req.session.username != undefined) {
    res.render('roulette.ejs', {
      item: req.session.username
    });
  } else {
    res.redirect('/login');
  }
});

app.get('/btn_test', (req, res) => {
  res.render("on_off.html");
});

//ルーレットボタンを押された時の処理
app.post('/start_btn', (req, res) => {
  //すでにルーレットを引いているかを調べる
  let flag = check_first_time(req.session.username);

  //押されたボタンがスタートボタンだった時の処理
  if (req.body.name == "START" && flag) {
    let info = new AssignInfo(req.session.username);
    let hit_idx = run_roulette(info.roulette.hit_rate, info.roulette.split_num)
    info.hit_user = info.possible_users[hit_idx];
    info.roulette.theta_target = cac_theta(info.roulette.angle_range, hit_idx, info.roulette.split_angle);
    console.log("hit: ", hit_idx, info.possible_users[hit_idx]);
    //結果を記録
    for (let i = 0; i < user_data.length; i++) {
      if (user_data[i].name == info.myuser_name) {
        user_data[i].destination = info.hit_user.name;
      }
    }

    //今回、出目となったユーザをimpossible_usersへ追加
    impossible_users.push(user_data.filter((v) => {
      return v.name == info.hit_user.name
    })[0]);
    console.log("impossible_users:", impossible_users);
    //ルーレットの出目に関する情報をクライアントへ返す
    res.json({
      info: info
    });
  }
});

//結果一覧表示
app.get('/result', (req, res) => {
  if (req.session.username != undefined) {
    res.render('result.ejs', {
      item: user_data
    });
  } else {
    res.redirect('/login');
  }
});

app.post('/reset', (req, res) => {
  if (req.session.username != undefined) {
    init_user();
    console.log("RESET-------");
    console.log(user_data);
    res.redirect('/result');
  } else {
    res.redirect('/login');
  }
});

app.get('/event', (req, res) => {
  if (req.session.username != undefined) {
    res.render('event.html');
  } else {
    res.redirect('/login');
  }
});


/**************/
/*ログイン認証*/
/**************/
login_authentication = function(name, password) {
  let name_auth = false;
  let pass_auth = false;

  for (let ele of user_data) {
    /*名前が一覧にあるか*/
    if (ele.name == name) {
      name_auth = true;
      break;
    } else {
      name_auth = false;
    }
  }
  /*パスワードの照合*/
  if (password === "password") {
    pass_auth = true;
  } else {
    pass_auth = false;
  };

  return (name_auth && pass_auth);
};


/************************/
/*ユーザ情報の初期化*/
/************************/
function init_user() {
  user_data = JSON.parse(fs.readFileSync('./data/member.json', 'utf8'))["users"];
  impossible_users = [];
}

//ルーレットをすでに引いているかを確認
function check_first_time(name) {
  for (let i = 0; i < user_data.length; i++) {
    //自分の名前を検索、送り先が登録されているか確認
    if (user_data[i].name == name && user_data[i].destination == '') {
      return true
    }
  }
  return false
}

/***********************/
/*ルーレット関連の処理**/
/**********************/
//出目の候補にならないユーザ(すでに出たユーザ)
let impossible_users = [];

//ルーレットの出目に関する情報を管理
const AssignInfo = class {
  constructor(username) {
    //自分のユーザ情報
    this.myuser_name = username;
    console.log("myuser:", this.myuser_name);
    //出目の候補となるユーザ
    this.possible_users = this.make_possible_users_list();
    this.roulette = new DesignRoulette(this.possible_users);
    this.hit_user;
  }
  //出目の候補となるユーザのリストを作成
  make_possible_users_list() {
    let possible_users = [];
    //出目の候補はusersのうちimpossibe_usersに含まれないものとする
    //ただし、自分の目は自分は引かないようにする
    for (let i = 0; i < user_data.length; i++) {
      let each_user = user_data[i];
      let addable = !impossible_users.some((v) => {
        return v.name == each_user.name
      });

      if ((addable == true) && (each_user.name != this.myuser_name)) {
        //候補として格納
        possible_users.push(each_user)
      }
    }
    return possible_users
  }
}

//ルーレット設計に関するクラス
const DesignRoulette = class {
  constructor(possible_users) {
    //ルーレットの分割数
    this.split_num = possible_users.length;
    //ルーレットの分割角度
    this.split_angle = this.cac_split_angle();
    //ルーレット上で各ユーザの占有角度範囲
    this.angle_range = this.cac_init_angle();
    //各目が出る確率(等確率)
    this.hit_rate = 1 / this.split_num;
  }

  //ルーレットの分割角度を計算
  cac_split_angle() {
    return 2 * Math.PI / this.split_num
  }
  //ルーレット上で各ユーザの占有角度範囲を計算
  cac_init_angle() {
    let angle_range = [];
    let elem = [];
    let theta = 0;
    for (let i = 0; i < this.split_num - 1; i++) {
      elem = [theta, theta + this.split_angle];
      theta = theta + this.split_angle;
      angle_range.push(elem);
    }
    angle_range.push([theta, 2 * Math.PI]);
    return angle_range
  }
}


//ルーレットの実行
function run_roulette(hit_rate, split_num) {
  return Math.floor(split_num * Math.random())
}

//回転角の計算 0~2piの範囲で返す
function cac_theta(angle_range, hit_idx, split_angle) {
  //console.log("angele",angle_range[hit_idx]);
  const theta = (3 / 2 * Math.PI) + 2 * Math.PI - 0.5 * (angle_range[hit_idx][1] + angle_range[hit_idx][0]) //+( Math.random()-0.5) * split_angle / 2//+ 2*Math.PI*(Math.floor(Math.random()*6)+2) //+ Math.random() * split_angle / 2
  console.log(theta);
  return theta
}


var server = app.listen(3000, function() {
  console.log("Node.js is listening to PORT:" + server.address().port);
});
