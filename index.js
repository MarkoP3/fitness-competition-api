const express = require("express");
const mysql = require("mysql");
const bodyParser = require("body-parser");
const url = require("url");
const querystring = require("querystring");
const connection = mysql.createPool({
  host: "eu-cdbr-west-01.cleardb.com",
  user: "bc3bee78fedd1c",
  password: "99b2122c",
  database: "heroku_221d49f6c99d98e",
});
const app = express();
app.listen(process.env.PORT || 8080);
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});
app.get("/api/categories", async (req, res) => {
  connection.query("SELECT * FROM category", (err, result) => {
    if (err) console.error(err);
    res.write(JSON.stringify(result));
    res.end();
  });
});

app.get("/api/disciplines", (req, res) => {
  let querystring =
    "SELECT discipline.id,discipline.name as discipline,discipline.first_place,discipline.second_place,discipline.third_place,discipline_type.name,discipline_type.unit from discipline,discipline_type where discipline_typeID=discipline_type.id";
  if (req.query.category != undefined)
    querystring = `SELECT discipline.id,discipline.name as discipline,discipline.first_place,discipline.second_place,discipline.third_place,discipline_type.name,discipline_type.unit from discipline,discipline_type,discipline_category,category where discipline_typeID=discipline_type.id and discipline_category.categoryID=category.id and discipline_category.disiplineID=discipline.id and category.id=${req.query.category}`;
  connection.query(querystring, (err, result) => {
    if (err) console.error(err);
    res.write(JSON.stringify(result));
    res.end();
  });
});

app.get("/api/competitors", (req, res) => {
  let querystring = `SELECT competitor.id as id,concat(competitor.first_name,' ',competitor.last_name) as name,concat(competes.quantity,' ',discipline_type.unit) as points from competitor,competes,discipline,discipline_type where discipline_type.id=discipline.discipline_typeID AND competes.disciplineID=discipline.id and competes.competitorID=competitor.id ${
    req.query.discipline != undefined
      ? `AND discipline.id=${req.query.discipline}`
      : ``
  } ${
    req.query.category != undefined
      ? `AND competitor.categoryID=${req.query.category}`
      : ``
  }`;
  connection.query(querystring, (err, result) => {
    if (err) console.error(err);
    res.write(JSON.stringify(result));
    res.end();
  });
});

app.get("/api/competitors/scoreboard", (req, res) => {
  let querystring = `SELECT competitor.id as id,concat(competitor.first_name,' ',competitor.last_name) as name,SUM(competes.points) as points   from competitor,competes,discipline where competes.disciplineID=discipline.id and competes.competitorID=competitor.id and competitor.categoryID=${req.query.category} GROUP BY concat(competitor.first_name,' ',competitor.last_name) ORDER BY points DESC `;
  connection.query(querystring, (err, result) => {
    if (err) console.error(err);
    res.write(JSON.stringify(result));
    res.end();
  });
});

/*

na update rekalkulisi TOTAL
SET @sum = (SELECT SUM(competes.quantity) from competitor,competes,discipline,discipline_type where competitor.id=competes.competitorID and competes.disciplineID=discipline.id and discipline.discipline_typeID=discipline_type.id AND discipline_type.name='ORM' and competitor.id=1);
SELECT @sum;
UPDATE competes SET competes.quantity=@sum where competitorID=1 AND disciplineID=(SELECT id from discipline where name='TOTAL');


*/
