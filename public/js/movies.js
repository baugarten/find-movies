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
              director: movie.artistName,
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
    var params = render(movie);
    params['IMAGE_LINK'] = movie[imagekey(true)];
    params['BIG'] = true;
    params['NETFLIX_AVAILABLE'] = movie.netflix && movie.netflix.instant;
    params['NETFLIX_URL'] = movie.netflix && movie.netflix.url;
    if (movie.amazon) {
      params['AMAZON'] = true;
      console.log(movie.amazon);
      params['AMAZON_SEARCHING'] = movie.amazon.searching;
      params['AMAZON_NOTFOUND'] = movie.amazon.notFound;
      params['AMAZON_URL'] = movie.amazon.url;
      params['AMAZON_PRICE'] = movie.amazon.instant;
    }
    /*
    var html = render(movie, true)
      .replace(/%IMAGE_LINK%/g, movie[imagekey(true)]) 
      .replace(/class=\'movie\'/, "class='movie big'")
      .replace(/%BIG%.*?%BIG%/, '')
      .replace(/%NETFLIX\.AVAILABLE%/, movie.netflix && movie.netflix.instant);
    if (movie.amazon && !movie.amazon.searching) {
      html = html.replace(/%AMAZON%/g, '');
      html = html.replace(/%AMAZON\.URL%/, '/static/images/amazon_logo.jpg');
      if (movie.amazon.url) {
        html = html.replace(/%AMAZON\.LINK%/, movie.amazon.url);
      }
      html = html.replace(/%AMAZON\.PRICE%/, movie.amazon.instant)
    } else {
      html = html.replace(/%AMAZON%.*?%AMAZON%/, '');
    }
    */
    //return html 
    return movieTmpl.render(params);
  }

  function renderSmall(movie) {
    /*jreturn movieStr = render(movie)
      .replace(/%IMAGE_LINK%/g, movie[imagekey(false)]) 
      .replace(/%BIG%/g, '');
      */
    params = render(movie);
    params['IMAGE_LINK'] = movie[imagekey(false)];
    params['BIG'] = false;
    console.log(params);
    console.log(movieTmpl.render(params));
    return movieTmpl.render(params);
  }

  function render2(movie) {
    return movieStr = movieTmpl
      .replace(/%ID%/g, movie.id)
      .replace(/%TITLE%/, movie.title)
      .replace(/\(%YEAR%\)/, movie.date)
      .replace(/%DESCRIPTION%/, movie.description)
  }
  function render(movie) {
    return {
      ID: movie.id,
      TITLE: movie.title,
      YEAR: movie.date,
      DESCRIPTION: movie.description,
    }
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
        /*console.log("NETFLIX UPDATED");
        console.log(movie.title);
        console.log(movie.netflix);*/
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
    if (movie.amazon || movie.amazon.searching) {
      console.log("Skipping amazon " + movie.title);
      return;
    }
    console.log("Searching amazon " + movie.title);
    movie.amazon = { searching: true };
    $.ajax({
      method: 'GET',
      url: '/amazon',
      data: {
        title: encodeURI(movie.title),
        year: movie.date.substring(1, movie.date.length - 1),
        director: movie.director,
      },
      success: function(data) {
        console.log("Searched amazon " + movie.title);
        var itemCount = data.ItemSearchResponse.Items.TotalResults,
            items = data.ItemSearchResponse.Items.Item,
            mostLikely, 
            sure = false,
            titleRegexp = new RegExp(movie.title, 'i');
        if (itemCount === 0) {
          console.log("NO AMAZON ITEMS FOUND");
          console.log(movie.title);
          movie.amazon.notFound = true;
          movie.amazon.searching = false;
          rerender(movie);
          return;
        }
        if (itemCount === 1) {
          mostLikely = items;
          sure = true;
        } else {
          mostLikely = items[0];
          for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (item.ItemAttributes.ProductTypeName !== "DOWNLOADABLE_MOVIE") {
              continue;
            }
            if (item.ItemAttributes.Title.match(titleRegexp)) {
              if (item.ItemAttributes.Title.length === movie.title.length) {
                mostLikely = item;
                sure = true;
              } else {
                if (!mostLikely) mostLikely = item;
              }
            }
          }
        }
        movie.amazon = {
          instant: mostLikely.Offers.Offer && mostLikely.Offers.Offer.OfferListing.Price.FormattedPrice,
          url: mostLikely.DetailPageURL,
          sure: sure,
          searching: false,
        }
        rerender(movie);
      },
      error: function(a, b, c) {
        console.log("FAILED AMAZON " + movie.title);
        console.log(a);
        console.log(b);
        console.log(c);
      }
    });
  }
  var movieTmpl = new t(" \
    <div class='movie {{BIG}} big {{/BIG}}' id='{{=ID}}'> \
      <div class='title'>{{=TITLE}} {{=YEAR}}</div> \
      <img src='{{=IMAGE_LINK}}' /> \
      <div class='description'>{{=DESCRIPTION}}</div> \
      {{BIG}} \
        <div class='links'> \
          {{AMAZON}} \
            {{AMAZON_SEARCHING}} \
              <img src='/static/images/ajax-loader.gif' />  \
            {{:AMAZON_SEARCHING}} \
              {{AMAZON_NOTFOUND}} \
                Could\'t find on amazon \
              {{:AMAZON_NOTFOUND}} \
                <a href='{{=AMAZON_URL}}'><img src='/static/images/amazon_logo.jpg' /></a> {{=AMAZON_PRICE}} \
              {{/AMAZON_NOTFOUND}} \
            {{/AMAZON_SEARCHING}} \
          {{/AMAZON}}  \
          {{NETFLIX_AVAILABLE}} \
            Free: <a href='{{=NETFLIX_URL}}'><img src='/static/images/netflix_logo.png' /></a> \
          {{:NETFLIX_AVAILABLE}} \
            Not available on netflix \
          {{/NETFLIX_AVAILABLE}} \
        </div> \
      {{/BIG}} \
    </div>");

  var movieTmpl2 = "\
    <div class='movie' id='%ID%'> \
      <div class='title'>%TITLE% (%YEAR%)</div> \
      <!-- <div class='img' style=\"background-image:url('%IMAGE_LINK%')\"></div> --> \
      <img src='%IMAGE_LINK%' /> \
      <div class='description'>%DESCRIPTION%</div> \
      <div class='links %BIG%hidden%BIG%'> \
        %AMAZON% <a href='%AMAZON.URL%'><img src='%AMAZON.LOGO%' /></a> %AMAZON.PRICE% %AMAZON%\
        NETFLIX: %NETFLIX.AVAILABLE% \
      </div> \
    </div> \
  ";


});
