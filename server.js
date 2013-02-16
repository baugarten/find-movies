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
  searchAmazon(1, req, res, handleAmazon);
});

function handleAmazon(trycount, req, res, err, results) {
  if (!err) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.write(results);
    return res.end();
  } else {
    if (trycount > 4) {
      res.writeHead(err);
      return res.end();
    }
    searchAmazon(trycount + 1, req, res, handleAmazon);
  }
}

function searchAmazon(trycount, req, res, callback) {
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
    if (error) {
      callback(trycount, req, res, error);
    } else {
      callback(trycount, req, res, undefined, results);
    }
  });
}

app.get('/vudu', function(req, res) {
  request('http://apicache.vudu.com/api2/claimedAppId/myvudu/format/application*2Fjson/_type/contentSearch/count/10/dimensionality/any/followup/ratingsSummaries/followup/totalCount/followup/usefulStreamableOffers/followup/credits/followup/ultraVioletability/includeComingSoon/true/offset/0/streamable/true/titleMagic/' + decodeURI(req.query.title).replace(/\s+/g, '+') + '/type/program/type/bundle/type/bonus', function(err, res2, body) {
    //console.log(body);
    body = body.substring(body.indexOf('{'), body.lastIndexOf('}')+1);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.write(body);
    res.end();

  });
});

app.listen(process.env.PORT || 3000);
