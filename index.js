const express = require("express");
const mysql = require("mysql");
const bodyParser = require("body-parser");
const connection = mysql.createPool({
  host: "eu-cdbr-west-01.cleardb.com",
  user: "bc3bee78fedd1c",
  password: "99b2122c",
  database: "heroku_221d49f6c99d98e",
  multipleStatements: true,
});
const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {});

server.listen(process.env.PORT || 8080);
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
app.use(function (err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  res.status(500);
  res.render("error", { error: err });
});
app.get("/api/categories", (req, res) => {
  try {
    connection.query("SELECT * FROM category ORDER BY id", (err, result) => {
      if (err) console.error(err);
      res.write(JSON.stringify(result));
      res.end();
    });
  } catch (error) {
    res.statusCode = 500;
    res.end();
  }
});

app.get("/api/disciplines", (req, res) => {
  try {
    let querystring =
      "SELECT discipline.id,discipline.name as discipline,discipline.first_place,discipline.second_place,discipline.third_place,discipline_type.name,discipline_type.unit from discipline,discipline_type where discipline_typeID=discipline_type.id";
    if (req.query.category != undefined)
      querystring = `SELECT discipline.id,discipline.name as discipline,discipline.first_place,discipline.second_place,discipline.third_place,discipline_type.name,discipline_type.unit from discipline,discipline_type,discipline_category,category where discipline_typeID=discipline_type.id and discipline_category.categoryID=category.id and discipline_category.disiplineID=discipline.id and category.id=${req.query.category} ORDER BY discipline.id`;
    connection.query(querystring, (err, result) => {
      if (err) console.error(err);
      res.write(JSON.stringify(result));
      res.end();
    });
  } catch (error) {
    res.statusCode = 500;
    res.end();
  }
});

app.get("/api/competitors", (req, res) => {
  try {
    let querystring = `SELECT competes.points as place,discipline.first_place as place1,discipline.second_place as place2,discipline.third_place as place3,category.name as category, competes.id as compID,discipline.name as discipline,discipline_type.name as type, competitor.id as id,concat(competitor.first_name,' ',competitor.last_name) as name,concat(competes.quantity,' ',discipline_type.unit) as points, competes.quantity as quantity from competitor,competes,discipline,discipline_type,category where category.id=competitor.categoryID and discipline_type.id=discipline.discipline_typeID AND competes.disciplineID=discipline.id and competes.competitorID=competitor.id ${
      req.query.discipline != undefined
        ? `AND discipline.id=${req.query.discipline}`
        : ``
    } ${
      req.query.category != undefined
        ? `AND competitor.categoryID=${req.query.category}`
        : ``
    } ${
      req.query.filter != undefined
        ? ` AND (concat(competitor.first_name,' ',competitor.last_name) LIKE '%${req.query.filter}%' OR discipline_type.name LIKE '%${req.query.filter}%' OR category.name LIKE '%${req.query.filter}%' OR discipline.name LIKE '%${req.query.filter}%')`
        : ``
    }`;
    querystring += ` ORDER BY category.name,discipline.name,discipline_type.name,competes.quantity DESC`;
    connection.query(querystring, (err, result) => {
      if (err) console.error(err);
      res.write(JSON.stringify(result));
      res.end();
    });
  } catch (error) {
    res.statusCode = 500;
    res.end();
  }
});

app.get("/api/competitors/scoreboard", (req, res) => {
  try {
    let querystring = `SELECT competitor.id as id,concat(competitor.first_name,' ',competitor.last_name) as name,SUM(competes.points) as points   from competitor,competes,discipline where competes.disciplineID=discipline.id and competes.competitorID=competitor.id and competitor.categoryID=${req.query.category} GROUP BY competitor.id,concat(competitor.first_name,' ',competitor.last_name) ORDER BY points DESC `;
    connection.query(querystring, (err, result) => {
      if (err) console.error(err);
      res.write(JSON.stringify(result));
      res.end();
    });
  } catch (error) {
    res.statusCode = 500;
    res.end();
  }
});
app.post("/api/competitors", (req, res) => {
  try {
    const { firstName, lastName, gender, weight, age } = req.body;
    let category = "";
    if (gender == "ж") category = "Жене";
    else if (age < 18) category = "И18";
    else if (weight <+ 70) category = "Лака кат.";
    else if (weight > 70 && weight <+ 82) category = "Средња кат.";
    else category = "Тешка кат.";
    let querystring = `INSERT INTO competitor VALUES(null,?,?,?,?,?,(SELECT id from category where name=?))`;
    connection.query(
      querystring,
      [firstName, lastName, gender, weight, age, category],
      (err, insertedResult) => {
        if (err) console.error(err);
        connection.query(
          `SELECT discipline.id as id,discipline_type.name as type,discipline.name as name FROM discipline_category,discipline,discipline_type where categoryID=(SELECT id from category where name='${category}') and discipline.id=discipline_category.disiplineID and discipline_typeID=discipline_type.id;`,
          (err, result) => {
            if (err) console.error(err);
            res.write(
              JSON.stringify({
                competitor: insertedResult.insertId,
                categories: result,
              })
            );

            io.emit("refresh", insertedResult.insertId);
            res.end();
          }
        );
      }
    );
  } catch (error) {
    res.statusCode = 500;
    res.end();
  }
});
app.post("/api/competes", (req, res) => {
  try {
    const { competitor, disciplines } = req.body;
    let values = [];
    disciplines.forEach((discipline) => {
      values.push([null, discipline, competitor, 0, 0]);
    });
    connection.query(
      "INSERT INTO competes VALUES ?",
      [values],
      (err, result) => {
        if (err) console.error(err);
        else {
          io.emit("refresh", competitor);
          res.end();
        }
      }
    );
  } catch (error) {
    res.statusCode = 500;
    res.end();
  }
});

app.post("/api/results", (req, res) => {
  try {
    const { competesID, result, competitor } = req.body;
    let querystring = `UPDATE competes set quantity=? where id=?;SET @sum = (SELECT SUM(competes.quantity) from competitor,competes,discipline,discipline_type where competitor.id=competes.competitorID and competes.disciplineID=discipline.id and discipline.discipline_typeID=discipline_type.id AND discipline_type.name='ORM' and competitor.id=?);SELECT @sum;UPDATE competes SET competes.quantity=@sum where competitorID=? AND disciplineID=(SELECT id from discipline where name='TOTAL');`;
    connection.query(
      querystring,
      [parseFloat(result), competesID, competitor, competitor],
      (err, result) => {
        if (err) console.error(err);
        io.emit("refresh", competitor);
        res.end();
      }
    );
  } catch (error) {
    res.statusCode = 500;
    res.end();
  }
});
app.post("/api/winner", (req, res) => {
  try {
    const { competesID, place } = req.body;
    let placeName =
      place == 1
        ? "first_place"
        : place == 2
        ? "second_place"
        : place == 3
        ? "third_place"
        : null;
    let querystring = `SET @points = ${
      place != null
        ? `(SELECT ${placeName} from  discipline,competes where discipline.id=competes.disciplineID and competes.id=?);`
        : `0`
    }
  UPDATE competes set points=@points where competes.id = ?;
  select competitorID from competes where id=?`;
    connection.query(
      querystring,
      [competesID, competesID, competesID],
      (err, result) => {
        if (err) console.error(err);
        io.emit("refresh", result[2][0].competitorID);
        res.end();
      }
    );
  } catch (error) {
    res.statusCode = 500;
    res.end();
  }
});
app.delete("api/competitors", (req, res) => {
  const { competitor } = req.body;
  let querystring;
  if (competitor != undefined)
    querystring =
      "DELETE FROM competitor where id IN (SELECT user from  (select competitor.id as user,competes.id as compID from competitor LEFT JOIN competes on competitor.id=competes.competitorID) as joined where joined.compID is null )";
  else querystring = `DELETE FROM competitor where id=%${competitor}%`;
  connection.query(querystring, (err, result) => {
    console.log(`result`, result);
    res.end();
  });
});
