var express = require('express');

var app = express();

app.set('title', 'Beemo');
app.set('views', __dirname + "/views");

app.set('view engine', 'jade');

app.use('/static', express.static(__dirname + "/public"));


app.configure('development', function(){
});

app.get('/', function(req, res) {
  res.render('index');
});

app.listen(process.env.PORT || 3000);
