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

const jsonObject = JSON.parse(fs.readFileSync('./data/member.json', 'utf8'));
const user_data = jsonObject["users"];
console.log(jsonObject);
console.log(jsonObject["users"][0]);

user_data.forEach(function(ele){
  console.log(ele.name);
  console.log(ele.name == "蛯澤皓斗");
});
