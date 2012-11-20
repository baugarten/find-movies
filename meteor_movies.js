
Movies = new Meteor.Collection("movies");
Session.set("ids", []);


if (Meteor.isClient) {
  var edited = false;
  Template.search.events({
    "input #search": function(event) {
      $.ajax({
        method: "GET",
        url: "https://itunes.apple.com/search",
        data: {
          term: $(event.currentTarget).val(),
          media: "movie",
          entity: "movie",
          attribute: "movieTerm",
          limit: 20,
        },
        dataType: "jsonp",
        success: function(a,b,c) {
          var ids = [];
          _.each(a.results, function(result) {
            ids.push(result.trackId);
            if (!Movies.findOne({id: result.trackId})) {
              Movies.insert({ 
                id: result.trackId,
                title: result.trackName, 
                artwork30: result.artworkUrl30,
                artwork60: result.artworkUrl60,
                artwork100: result.artworkUrl100,
                itunesPrice: result.collectionPrice,
                releaseDate: result.releaseDate,
              });
            }
          });
          Session.set("ids", ids);
        },
      });
    }
  });

  Template.results.events({
    'click input' : function () {
      // template data, if any, is available in 'this'
      if (typeof console !== 'undefined')
        console.log("You pressed the button");
    }
  });
  Template.results.movies = function() {
    return Movies.find({id: {$in: Session.get("ids")}});
  }
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    var collections = ['movies'];

    _.each(collections, function(collection) {
        _.each(['insert', 'update', 'remove'], function(method) {
        });
    });
  });
}
