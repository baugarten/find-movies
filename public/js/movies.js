$(document).ready(function() {
  $("input").keyup(function(event) {
    search($(this).val());
  });

  var publishedTime = 0,
      movieData = {};


  function search(value) {
    var curTime = new Date().getTime();
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
        showMovies(data.results, curTime);
      },
      error: function(xhr, status, errorThrown) {},
    });
  }

  function showMovies(movieList, time) {
    var movies = "",
        display = true,
        big = (movieList.length <= 4);
        imageFormat = big ? '600x600' : '225x225'; 
    movieList.forEach(function(movie) {
      if (publishedTime > time) {
        display = false; 
        return;
      }
      var movieStr = "",
          cutdesc = (movie.longDescription) ? movie.longDescription.substring(0, 210) : "",
          desc = cutdesc.substring(0, cutdesc.lastIndexOf(' ')) + "<br />Read more...",
          newMovie = (movie.trackId in movieData) ? movieData[movie.trackId] :
            {
              id: movie.trackId,
              title: movie.trackName,
              date: movie.trackName.match(/\d{4}/) ? "" : '('+movie.releaseDate.substring(0, 4)+')',
              description: desc,
              netflix: false,
              amazon: false,
            };
      newMovie[imagekey(big)] = movie.artworkUrl100.replace(/100x100/, imageFormat);
      movieData[newMovie.id] = newMovie;
      if (big) {
        getInfo(newMovie);
        movieStr = renderBig(newMovie);
      } else {
        movieStr = renderSmall(newMovie)
      }
      movies = movies + movieStr;
    });
    if (display) { 
      publishedTime = time;
      $("#results").html(movies);
      postRender();
    }
  }

  function renderBig(movie) {
    var html = render(movie, true)
      .replace(/%IMAGE_LINK%/g, movie[imagekey(true)]) 
      .replace(/class=\'movie\'/, "class='movie big'")
      .replace(/%BIG%.*?%BIG%/, '')
      .replace(/%AMAZON\.PRICE%/, movie.amazon && movie.amazon.instant)
      .replace(/%NETFLIX\.AVAILABLE%/, movie.netflix && movie.netflix.instant);
    if (movie.amazon) {
      html = html.replace(/%AMAZON%/g, '');
      html = html.replace(/%AMAZON%/g, '');
    } else {
      html = html.replace(/%AMAZON%.*?%AMAZON%/, '');
    }
    console.log(movie.amazon.instant);
    console.log(movie.netflix.instant);
    return html 
  }

  function renderSmall(movie, big) {
    big = !!big;
    return movieStr = render(movie)
      .replace(/%IMAGE_LINK%/g, movie[imagekey(false)]) 
      .replace(/%BIG%/g, '');
  }

  function render(movie) {
    return movieStr = movieTmpl
      .replace(/%ID%/g, movie.id)
      .replace(/%TITLE%/, movie.title)
      .replace(/\(%YEAR%\)/, movie.date)
      .replace(/%DESCRIPTION%/, movie.description)
  }

  function imagekey(big) {
    return 'image' + ((big) ? 'Big' : 'Small');
  }

  function getInfo(movie) {
    netflixUpdate(movie);
    amazonUpdate(movie);
  }

  function rerender(movie) {
    if ($("#" + movie.id).length < 1 || !$("#" + movie.id).hasClass('big')) return;
    var html = renderBig(movie);
    $("#" + movie.id).replaceWith(html);
  }

  function postRender() {
    /*var num = $(".movie").length;
    console.log(num);
    if (num < 4) {
      $(".movie.big").css({
        width: (100/num - 1) + "%"
      });
    }*/
  }

  function netflixUpdate(movie) {
    if (movie.netflix) return;

    $.ajax({
      method: "GET",
      url: "/netflix",
      data: {
        title: encodeURI(movie.title),
        year: movie.date.substring(1, movie.date.length - 1),
      },
      success: function(data) {
        if (data.d.results.length < 1) {
          movie.netflixNotFound = true;
          return;
        }
        var props = data.d.results[0];
        movie.netflix = {
          instant: props.Instant.Available,
          url: props.Url
        };
        rerender(movie);
      },
      error: function(a, b, c) {
        console.log(a);
        console.log(b);
        console.log(c);
      },
    });
  }
  function amazonUpdate(movie) {
    if (movie.amazon) return;
    console.log("AMAZON UPDATE");
    $.ajax({
      method: 'GET',
      url: '/amazon',
      data: {
        title: encodeURI(movie.title),
        year: movie.date.substring(1, movie.date.length - 1),
      },
      success: function(data) {
        console.log(data);
        var items = data.ItemSearchResponse.Items.Item;
        if (!items || items.length < 0) {
          movie.amazonNotFound = true;
          return;
        }
        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          if (item.ItemAttributes.ProductTypeName !== "DOWNLOADABLE_MOVIE") {
            continue;
          }
          movie.amazon = {
            instant: item.Offers.Offer.OfferListing.Price.FormattedPrice,
            url: item.DetailPageUrl,
          }
          console.log("UPDATED");
          console.log(movie.amazon);
          rerender(movie);
        }
      },
      error: function(a, b, c) {
        console.log(a);
        console.log(b);
        console.log(c);
      }
    });
  }

  var movieTmpl = "\
    <div class='movie' id='%ID%'> \
      <div class='title'>%TITLE% (%YEAR%)</div> \
      <!-- <div class='img' style=\"background-image:url('%IMAGE_LINK%')\"></div> --> \
      <img src='%IMAGE_LINK%' /> \
      <span class='description'>%DESCRIPTION%</span> \
      <div %BIG% class='hidden' %BIG%> \
        %AMAZON% <img src='/static/images/amazon_logo.jpg' /> %AMAZON.PRICE% %AMAZON%\
        NETFLIX: %NETFLIX.AVAILABLE% \
      </div> \
    </div> \
  ";


});
