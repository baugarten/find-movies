var express = require('express'),
    http = require('http'),
    request = require('request'),
    OperationHelper = require('apac').OperationHelper,
    parser = require('xml2json');

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
  opHelper.execute('ItemSearch', {
    'BrowseNode': '2858778011',
    'SearchIndex': 'Video',
    'Keywords': decodeURI(req.query.title),
    //'Title': decodeURI(req.query.title),
    'ResponseGroup': 'ItemAttributes,Offers'
  }, function(error, results) {
    if (error) {
      res.writeHead(500);
      res.write(error);
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.write(parser.toJson(results));
      res.end();
    }
    
  });
});

app.listen(process.env.PORT || 3000);
