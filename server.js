var express = require('express'),
    http = require('http'),
    request = require('request'),
    OperationHelper = require('json-apac').OperationHelper;

var app = express();

app.set('title', 'Beemo');
app.set('views', __dirname + "/views");

app.set('view engine', 'jade');

app.use('/static', express.static(__dirname + "/public"));

app.use(express.query());

var opHelper = new OperationHelper({
  awsId: process.env.AWSACCESSKEYID,
  awsSecret: process.env.AWSSECRET, 
  assocId: process.env.AWSASSOCIATETAG, 
});

app.configure('development', function(){
});

app.get('/', function(req, res) {
  res.render('index');
});

app.get('/netflix', function(req, res) {
  request("http://odata.netflix.com/Catalog/Titles?$filter=Name eq '" + decodeURI(req.query.title) + "' and ReleaseYear eq " + req.query.year + "&$format=json", function(err, res2, body) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.write(body);
    res.end();
  });
});

app.get('/amazon', function(req, res) {
  console.log("Servicing search for " + req.query.title);
  opHelper.execute('ItemSearch', {
    'BrowseNode': '2858778011',
    'SearchIndex': 'Video',
    'Title': decodeURI(req.query.title),
    //'Keywords': req.query.year,
    //'Director': req.query.director,
    'ResponseGroup': 'ItemAttributes,Offers'
  }, function(error, results) {
    console.log("Got search for " + req.query.title);
    console.log(error);
    if (error) {
      res.writeHead(500);
      res.write(error);
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.write(results);
      res.end();
    }
    
  });
});

app.listen(process.env.PORT || 3000);
