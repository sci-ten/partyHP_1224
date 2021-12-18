//サーバから送られてきたルーレットの情報を格納
let game_info;
//ルーレットのモード
var Mode = {
  waiting: 0,
  acceleration: 1,
  constant: 2,
  deceleration: 3,
  result: 4
};

var mode = Mode.waiting;


// start,stopボタン
$('.btn').on('click', function() {
  if ($(this).val() === 'STOP') {
    //STOPボタンが押された時に呼び出される
    $(this).toggleClass("btn_stop", [false]);
    $(this).toggleClass("btn_finish", [true]);
    $(this).val('FINISH');
    $.post('/start_btn', 'name=STOP')
    mode = Mode.deceleration;
    //以降のルーレットの回転角度を決定
    game_info.roulette.rotation = game_info.roulette.theta_target - theta + 2 * Math.PI * (Math.floor(Math.random() * 6) + 3);

  } else if ($(this).val() === 'START') {
    //STARTボタンが押されたときに呼び出される
    $(this).toggleClass("btn_start", [false]);
    $(this).toggleClass("btn_stop", [true]);
    $(this).val('STOP');
    //STARTボタンが押されたことをPOSTで伝える
    $.post('/start_btn', 'name=START')
      .done(function(data) {
        mode = Mode.acceleration;
        game_info = data.info;
        game_info.roulette.color_list = get_color_list(game_info.roulette.split_num);
        console.log("get game data",game_info);
      });
  }
});


const ACCEL = 0.01;
const DECEL = 0.002;
const TIME_CONSTANT = 1;
const MAX_SPEED = 1.0;
const MIN_SPEED = 0.1;
const RADIUS = 100;
const COLOR_ADJ = 0.4;
const TRIANGLE_SIZE = 20;
const MARGIN = 10;
const DECEL_RAND_LEVEL = 10;
const DECEL_RAND_MAGNITUDE = 0.001;
//回転角
let theta = 0;
let speed = 0;
//結果表示のフラグ
let result_flag = false;

function get_color_list(len) {
  var colors = [];
  for (var i = 0; i < len; i++) {
    colors.push(Math.floor(255 / len * i));
  }
  colorList = [];
  if (len % 2 == 0) {
    for (var i = 0; i < len; i += 2) {
      colorList[i] = colors[Math.floor(i / 2)];
    }
    for (var i = 1; i < len; i += 2) {
      colorList[i] = colors[Math.floor(i / 2 + len / 2)];
    }
  } else {
    for (var i = 0; i < len; i += 2) {
      colorList[i] = colors[Math.floor(i / 2)];
    }
    for (var i = 1; i < len; i += 2) {
      colorList[i] = colors[Math.floor(i / 2) + Math.floor(len / 2) + 1];
    }
  }
  return colorList;
}



function draw() {
  fill(0, 0);
  rect(0, 0, width, height);
  translate(width / 2, height / 2);

  fill(255, 255, 0);
  push();
  translate(0, -RADIUS - MARGIN);
  triangle(0, 0, -TRIANGLE_SIZE / 2, -TRIANGLE_SIZE, TRIANGLE_SIZE / 2, -TRIANGLE_SIZE);
  pop();

  switch (mode) {
    case Mode.waiting:
      break;
    case Mode.acceleration:
      if (speed < MAX_SPEED) {
        speed += ACCEL;
      } else {
        mode = Mode.constant;
        speed = MAX_SPEED;
      }
      theta += speed;
      theta -= (Math.floor(theta / 2 / PI)) * 2 * PI;

      rotate(theta);
      drawRoulette();
      break;
    case Mode.constant:
      theta += speed;
      theta = theta % (2 * Math.PI);

      rotate(theta);
      drawRoulette();
      break;
    case Mode.deceleration:
      if (speed > MIN_SPEED) {
        speed -= DECEL;
      } else {
        speed = MIN_SPEED;
      }

      if (game_info.roulette.rotation - speed <= 0) {
        theta = game_info.roulette.theta_target%(2*Math.PI);
        mode = Mode.result;
      } else {
        game_info.roulette.rotation -= speed;
        theta += speed
      }
      theta = theta % (2 * Math.PI);
      rotate(theta);
      drawRoulette();
      break;
    case Mode.result:
      rotate(theta);
      if (result_flag == false){
          show_result();
          result_flag = true;
      }
      break;
  }
}

function drawRoulette() {

  var angleSum = 0.0;
  push();
  colorMode(HSL, 255);
  for (var i = 0; i < game_info.roulette.split_num; i++) {
    colorMode(HSL, 255);
    fill(game_info.roulette.color_list[i], 255 - COLOR_ADJ * game_info.roulette.color_list[i], 128);
    arc(0, 0, RADIUS * 2, RADIUS * 2, angleSum, angleSum + 2 * PI * game_info.roulette.hit_rate);
    textAngle = angleSum + game_info.roulette.hit_rate * 2 * PI * 0.5;
    angleSum += game_info.roulette.hit_rate * 2 * PI;
    //名前を書き込む
    textSize(12);
    fill(0, 0, 0);
    text(game_info.possible_users[i].name, 0.7 * RADIUS * Math.cos(textAngle) - 20, 0.7 * RADIUS * Math.sin(textAngle));
  }
  pop();
}

function setup() {
  var canvas = createCanvas(450, 300);
  canvas.parent('canvas');
  textSize(20);
  stroke(0, 0);
  fill(0, 0);
  background(0, 0);
}

function show_result(){
  console.log("show",game_info.hit_user);
  const new_element = document.createTextNode(String(game_info.hit_user.name)+"さん");
  console.log(document.getElementsByClassName("present"));
  document.getElementsByClassName("present")[0].appendChild(new_element);
}
