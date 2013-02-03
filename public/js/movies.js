$(document).ready(function() {
  $("input").keyup(function(event) {
    search($(this).val());
  });

  var publishedTime = 0,
      movieData = [];


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
        date = new Date(),
        big = (movieList.length <= 4);
        imageFormat = big ? '600x600' : '225x225'; 
    console.log(movieList[0]);
    movieList.forEach(function(movie) {
      if (publishedTime > date.getTime()) {
        display = false; 
        return;
      }
      var cutdesc = movie.longDescription.substring(0, 210),
          desc = cutdesc.substring(0, cutdesc.lastIndexOf(' ')) + "<br />Read more...",
          newMovie = {
            title: movie.trackName,
            date: movie.trackName.match(/\d{4}/) ? "" : '('+movie.releaseDate.substring(0, 4)+')',
            description: desc,
          };
      newMovie[imagekey(big)] = movie.artworkUrl100.replace(/100x100/, imageFormat);
      movieData.push(newMovie);
      var movieStr = movieTmpl
        .replace(/%IMAGE_LINK%/g, newMovie[imagekey(big)]) 
        .replace(/%TITLE%/, newMovie.title)
        .replace(/\(%YEAR%\)/, newMovie.date)
        .replace(/%DESCRIPTION%/, newMovie.description);
      if (big) movieStr = movieStr.replace(/class=\'title\'/, "class='title big'");
      if (big) movieStr = movieStr.replace(/class=\'movie\'/, "class='movie big'");
      movies = movies + movieStr;
    });
    if (display) { 
      publishedTime = date.getTime();
      $("#results").html(movies);
    }
  }

  function imagekey(big) {
    return 'image' + ((big) ? 'Big' : 'Small');
  }

  function getInfo(movie) {

  }

  var movieTmpl = "\
    <div class='movie'> \
      <div class='title'>%TITLE% (%YEAR%)</div> \
      <!-- <div class='img' style=\"background-image:url('%IMAGE_LINK%')\"></div> --> \
      <img src='%IMAGE_LINK%' /> \
      <span class='description'>%DESCRIPTION%</span> \
    </div> \
  ";


});
