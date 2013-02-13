$(document).ready(function() {
  var date = new Date(),
      publishedTime = 0,
      typeTime = date.getTime(),
      timeout,
      movieData = {},
      displayed = [],
      curSearch = '',
      big = false,
      timedout = false;

  $("input").focus();

  function equalize(group) {
    var tallest = 0;
    group.each(function() {
      if ($(this).height() > tallest) tallest = $(this).height();
    });
    group.height(tallest);
  }

  $("input").keyup(function(event) {
    clearTimeout(timeout);
    search($(this).val());
    timeout = setTimeout(function() {
      if (!big) {
        big = true;
        timedout = true;
        displayed.forEach(function(movieid) {
          getInfo(movieData[movieid]);
        });
      }
    }, 1500);
  });



  function search(value) {
    if (value === curSearch) return;
    curSearch = value;
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
        imageFormat = big ? '600x600' : '225x225'; 
    if (!timedout) big = (movieList.length <= 4);
    displayed = [];
    movieList.forEach(function(movie) {
      if (publishedTime > time) {
        display = false; 
        return;
      }
      var movieStr = "",
          cutdesc = (movie.longDescription) ? movie.longDescription.substring(0, 180) : "",
          desc = cutdesc.substring(0, cutdesc.lastIndexOf(' ')) + "<br />Read more...",
          newMovie = (movie.trackId in movieData) ? movieData[movie.trackId] :
            {
              id: movie.trackId,
              title: movie.trackName,
              date: movie.trackName.match(/\d{4}/) ? "" : '('+movie.releaseDate.substring(0, 4)+')',
              description: desc,
              netflix: false,
              amazon: false,
              vudu: false,
              director: movie.artistName,
              itunes: {
                url: movie.trackViewUrl,
                buyPrice: '$' + movie.trackPrice,
              }
            };
      newMovie[imagekey(big)] = movie.artworkUrl100.replace(/100x100/, imageFormat);
      movieData[newMovie.id] = newMovie;
      displayed.push(newMovie.id);
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
      equalize($(".movie"));
      $(".movie").css({ 'margin-top': "20px" });
    }
  }

  function renderBig(movie) {
    var params = render(movie);
    params['IMAGE_LINK'] = movie[imagekey(true)];
    params['BIG'] = true;
    params['NETFLIX_AVAILABLE'] = movie.netflix && movie.netflix.instant;
    params['NETFLIX_URL'] = movie.netflix && movie.netflix.url;
    params['ITUNES_BUY'] = movie.itunes.buyPrice;
    params['ITUNES_URL'] = movie.itunes.url;
    if (movie.amazon) {
      params['AMAZON'] = movie.amazon && movie.amazon.instant;
      params['AMAZON_SEARCHING'] = movie.amazon.searching;
      params['AMAZON_NOTFOUND'] = movie.amazon.notFound;
      params['AMAZON_URL'] = movie.amazon.url;
      params['AMAZON_PRICE'] = movie.amazon.instant;
    }
    if (movie.vudu) {
      params['VUDU_URL'] = movie.vudu.url;
      params['VUDU_BUY'] = movie.vudu.pto || false;
      params['VUDU_RENT'] = movie.vudu.ptr || false;
    }
    return movieTmpl.render(params);
  }

  function renderSmall(movie) {
    params = render(movie);
    params['IMAGE_LINK'] = movie[imagekey(false)];
    params['BIG'] = false;
    return movieTmpl.render(params);
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
    vuduUpdate(movie);
  }

  function rerender(movie) {
    if (!big || $("#" + movie.id).length < 1) return;
    var html = renderBig(movie);
    $("#" + movie.id).replaceWith(html);
    console.log("EQUALIEZ");
    console.log($("#" + movie.id + " .thumbnails .link"));
    equalize($("#" + movie.id + " .thumbnails .link"));
    equalize($(".movie"));
    $(".movie").css({ 'margin-top': "20px" });
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
        movie.amazon.searching = false;
        var itemCount = data.ItemSearchResponse.Items.TotalResults,
            items = data.ItemSearchResponse.Items.Item,
            mostLikely, 
            sure = false,
            titleRegexp = new RegExp(movie.title, 'i');
        if (itemCount === 0) {
          movie.amazon.notFound = true;
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
            var title = $($.parseHTML(item.ItemAttributes.Title)[0]).text();
            if (title .match(titleRegexp)) {
              if (title.length === movie.title.length) {
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
        if (!movie.amazon.instant) {
          movie.amazon = {
            notFound: true,
          }
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

  function vuduUpdate(movie) {
    if (movie.vudu || movie.vudu.searching) {
      console.log("Skipping vudu " + movie.title);
      return;
    }
    console.log("Searching vudu " + movie.title);
    movie.vudu = { searching: true };
    $.ajax({
      method: "GET",
      url: "/vudu",
      data: {
        title: movie.title,
        year: movie.year,
        director: movie.director
      },
      success: function(data) {
        console.log(movie.title);
        console.log(data);
        movie.vudu.searching = false;
        var items,
            totalCount = parseInt(data.totalCount[0]),
            found,
            titleRegexp = new RegExp(movie.title, 'i');
        if (totalCount === 0) {
          movie.vudu.notFound = true;
          return rerender(movie);
        }
        items = data.content;
        found = items[0];
        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          if (item.title[0].match(titleRegexp)) {
            if (item.title[0].length === movie.title.length) {
              found = item;
              sure = true;
              break;
            } else {
              if (!found) found = item;
            }
          }
        }
        var rentPrice,
            ownPrice;
        found.contentVariants.forEach(function(variant) {
          variant.contentVariant[0].offers[0].offer.forEach(function(offer) {
            if (offer.offerType[0] === 'pto') {
              movie.vudu.pto = '$' + parseFloat(offer.price[0]);
            } else if (offer.offerType[0] === 'ptr') {
              movie.vudu.ptr = '$' + parseFloat(offer.price[0]);
            }
          });

        });

        movie.vudu.url = 'http://www.vudu.com/movies/#!content/' + found.contentId;
      },
      error: function(a,b,c) {
        console.log(a);
        console.log(b);
        console.log(c);
      },
    }); 
  }
  var movieTmpl = new t(" \
    <div class='movie {{BIG}} span6 {{:BIG}} span4 {{/BIG}}' id='{{=ID}}'> \
      <div class='row'> \
        <div class='{{BIG}} span6 {{:BIG}} span4 {{/BIG}} title'>{{=TITLE}} {{=YEAR}}</div> \
      </div> \
      <div class='row'> \
        <div class='span2'> \
          <img src='{{=IMAGE_LINK}}' /> \
        </div> \
        <div class='span2'> \
          <div class='description'>{{=DESCRIPTION}}</div> \
        </div> \
        {{BIG}} \
          <ul class='thumbnails links'> \
            {{AMAZON}} \
              <li class='span1 link'> \
                <div class='thumbnail'> \
              {{AMAZON_SEARCHING}} \
                <img src='/static/images/ajax-loader.gif' />  \
              {{:AMAZON_SEARCHING}} \
                {{AMAZON_NOTFOUND}} \
                {{:AMAZON_NOTFOUND}} \
                      <a href='{{=AMAZON_URL}}'><img src='/static/images/amazon_icon.png' /></a> \
                      <div class='price'> \
                        {{=AMAZON_PRICE}} \
                      </div> \
                {{/AMAZON_NOTFOUND}} \
              {{/AMAZON_SEARCHING}} \
                </div> \
              </li> \
            {{/AMAZON}}  \
            {{VUDU_RENT}} \
              <li class='span1 link'> \
                <div class='thumbnail'> \
                  <a href='{{=VUDU_URL}}'><img src='/static/images/vudu_icon.png' /></a> \
                  <div class='price'> \
                    {{=VUDU_RENT}} \
                  </div> \
                </div> \
              </li> \
            {{/VUDU_RENT}} \
            {{NETFLIX_AVAILABLE}} \
              <li class='span1 link'> \
                <div class='thumbnail'> \
                  <a href='{{=NETFLIX_URL}}'><img src='/static/images/netflix_icon.png' /></a> \
                  <div class='price'> \
                    Free \
                  </div> \
                </div> \
              </li> \
            {{:NETFLIX_AVAILABLE}} \
            {{/NETFLIX_AVAILABLE}} \
            {{ITUNES_BUY}} \
              <li class='span1 link'> \
                <div class='thumbnail'> \
                  <a href='{{=ITUNES_URL}}'><img src='/static/images/itunes_icon.png' /></a> \
                  <div class='price'> \
                    {{=ITUNES_BUY}} \
                  </div> \
                </div> \
              </li> \
            {{/ITUNES_BUY}} \
            {{VUDU_BUY}} \
              <li class='span1 link'> \
                <div class='thumbnail'> \
                  <a href='{{=VUDU_URL}}'><img src='/static/images/vudu_icon.png' /></a> \
                  <div class='price'> \
                    {{=VUDU_BUY}} \
                  </div> \
                </div> \
              </li> \
            {{/VUDU_BUY}} \
            </div> \
          </div> \
        {{/BIG}} \
      </div> \
    </div>");
});
