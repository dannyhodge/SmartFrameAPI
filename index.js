const express = require("express");
const pg = require("pg");
const app = express();
const fs = require("fs");
const v4 = require("uuid");
const multer = require("multer");
const cors = require('cors')
const upload = multer();

const port = process.env.PORT || 3002;

const { Storage } = require("@google-cloud/storage");

const storage = new Storage({
  keyFilename: "E:\\Development\\Keyfile\\keyfile.json",
});

const connectionString =
  "postgres://suujehnkqbduna:8f80889d7a183ef9e0dd59d2c619e5bd9c4851981a1f13c4cb508135e53f6af1@ec2-34-255-134-200.eu-west-1.compute.amazonaws.com:5432/d3scsfgsbd5m4r?ssl=true";

let bucketName = "gs://smart-frame-f6933.appspot.com";
let localFilename = "images/image.png";

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.get("/images", cors(), (req, res) => {
  pg.connect(connectionString, function (err, client, done) {
    client.query(
      "SELECT image_location FROM smartframe.images",
      function (err, result) {
        var rows = [];
        var itemsProcessed = 0;
        result.rows.forEach((row) => {
          var location = row["image_location"];
          var file = storage.bucket(bucketName).file(location);
          file
            .getSignedUrl({
              action: "read",
              expires: "03-09-2491",
            })
            .then((signedUrl) => {
              rows.push({ signedUrl, location });
              itemsProcessed++;
              if (itemsProcessed == result.rows.length) res.send(rows); 
            });
        });

        if (err) return console.error(err); 
      }
    );
  });
});

app.post("/newimage", upload.any(), (req, res) => {
  console.log("POST /newimage/");
  if(req.files == null) res.status(500).send("incorrect input");
  console.log("Files: ", req.files);
  fs.writeFile("./images/image.png", req.files[0].buffer, (err) => {
    if (err) {
      console.log("Error: ", err);
      res.status(500).send("An error occurred: " + err.message);
    } else {
      uploadFile();

      res.status(200).send("ok");
    }
  });
});

const uploadFile = async () => {
  // Uploads a local file to the bucket

  var filename = "" + v4.v4() + ".png";

  const options = {
    destination: filename,
    resumable: true,
    validation: "crc32c",
    metadata: {
      metadata: {
        firebaseStorageDownloadTokens: v4.v4(),
      },
    },
  };
  storage
    .bucket(bucketName)
    .upload(localFilename, options, function (err, file) {
    });

  console.log("Filename: ", filename);
  console.log("Filenametype: ", typeof filename);
  pg.connect(connectionString, function (err, client, done) {
    client.query(
      `INSERT INTO smartframe.images (image_location) VALUES ('${filename}')`,
      function (err, result) {
        done();

        if (err) return console.error(err);
        console.log(result.rows.length);
      }
    );
  });
  console.log(`${filename} uploaded to ${bucketName}.`);
};

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
