$(document).ready(function() {
  $("input").keyup(function(event) {
    search($(this).val());
  });

  var publishedTime = 0;

  function search(value) {
    $.ajax({
      method: "GET",
      url: "https://itunes.apple.com/search",
      data: {
        term: value,
        media: "movie",
        entity: "movie",
        attribute: "movieTerm",
        limit: 20,
      },
      dataType: "jsonp",
      success: function(data, textStatus, xhr) {
        var curTime = new Date().getTime();
        showMovies(data.results);
      },
      error: function(xhr, status, errorThrown) {},
    });
  }

  function showMovies(movieList) {
    var movies = "",
        display = true,
        date = new Date();
    movieList.forEach(function(movie) {
      console.log(publishedTime > date.getTime());
      if (publishedTime > date.getTime()) {
        display = false; 
        return;
      }
      var movieStr = movieTmpl
        .replace(/%IMAGE_LINK%/, movie.artworkUrl100.replace(/100x100/g, '225x225'))
        .replace(/%TITLE%/, movie.trackName);
      movies = movies + movieStr;
    });
    if (display) { 
      publishedTime = date.getTime();
      $("#results").html(movies);
    }
  }

  var movieTmpl = "\
    <div class='movie'> \
      <img src='%IMAGE_LINK%' /> \
      %TITLE% \
    </div> \
  ";


});
