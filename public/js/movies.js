$(document).ready(function() {
  var date = new Date(),
      publishedTime = 0, // The time of the last search to be published
      typeTime = date.getTime(), // Last time the person typed
      timeout, // the timeout on typing
      movieData = {}, // a dict to cache movie information
      displayed = [], // a list of currently displayed movie ids
      curSearch = '', // current search string
      big = false, // whether we are showing 'big' movies
      timedout = false; // whether we have timedout on a search

  $("input").focus();

  function overlay(elem) {
    $(elem).overlay({
      oneInstance: false,
      color: '#ccc',
      top: 50,
      mask: {
        color: '#111111',
        loadSpeed: 200,
        opacity: 0.9
      },
      onBeforeLoad: function(event) {
        renderOverlay(parseInt($(event.originalEvent.currentTarget).attr('id')));
      },
      target: $("#overlay"),
    });
  }

  function renderOverlay(movieid) {
    var context = movieData[movieid],
        params = paramsBig(context);
    for (var attr in params) {
      context[attr] = params[attr];
    }
    $("#overlay").html(overlayTmpl.render(context));
    equalize($("overlay .thumbnails .link"));
  }

  function equalize(group) {
    var tallest = 0;
    group.each(function() {
      if ($(this).height() > tallest) tallest = $(this).height();
    });
    group.height(tallest);
  }

  $("input").keyup(function(event) {
    big = false;
    timedout = false;
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

  /*
   * Searches the iTunes API for movies
   */
  function search(value) {
    if (value === curSearch) return; 
    curSearch = value;
    var curTime = date.getTime();
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
        display = true;
    
    if (!timedout) big = (movieList.length <= 4);
    displayed = [];
    movieList.forEach(function(movie) {
      if (publishedTime > time) {
        display = false; 
        return;
      }
      var movieStr = "",
          cutdesc = (movie.longDescription) ? movie.longDescription.substring(0, 180) : "",
          desc = cutdesc.substring(0, cutdesc.lastIndexOf(' '));
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
                buyPrice: (movie.trackPrice ? '$' + movie.trackPrice : false)
              }
            };
      newMovie[imagekey(false)] = movie.artworkUrl100.replace(/100x100/, '225x225');
      newMovie[imagekey(true)] = movie.artworkUrl100.replace(/100x100/, '600x600');
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
      displayed.forEach(function(id) {
        overlay("#" + id);
      });
    }
  }

  function renderBig(movie) {
    return movieTmpl.render(paramsBig(movie));
  }

  function paramsBig(movie) {
    var params = render(movie);
    params['IMAGE_LINK'] = movie[imagekey(true)];
    params['BIG'] = true;
    params['NETFLIX_AVAILABLE'] = movie.netflix && movie.netflix.instant;
    params['NETFLIX_URL'] = movie.netflix && movie.netflix.url;
    params['ITUNES'] = movie.itunes && !!movie.itunes.buyPrice;
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
    return params
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
    var updated = false;
    updated = updated || netflixUpdate(movie);
    updated = updated || amazonUpdate(movie);
    updated = updated || vuduUpdate(movie);
    if (!updated) rerender(movie);
  }

  function rerender(movie) {
    if (!big || $("#" + movie.id).length < 1) return;
    var html = renderBig(movie);
    $("#" + movie.id).replaceWith(html);

    equalize($(".movie"));
    $(".movie").css({ 'margin-top': "20px" });
    overlay('#' + movie.id);
  }

  function netflixUpdate(movie) {
    if (movie.netflix) return false;

    $.ajax({
      method: "GET",
      url: "/netflix",
      data: {
        title: encodeURI(movie.title),
        year: movie.date.substring(1, movie.date.length - 1),
      },
      success: function(data) {
        if (!data.d || data.d.results.length < 1) {
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
      return false;
    }
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
            if (title.match(titleRegexp)) {
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
      return false;
    }
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
    <div class='movie {{BIG}} span6 {{:BIG}} span4 {{/BIG}}' id='{{=ID}}' rel='#overlay'> \
      <div class='row'> \
        <h1 class='{{BIG}} span6 {{:BIG}} span4 {{/BIG}} title'>{{=TITLE}} {{=YEAR}}</h1> \
      </div> \
      <div class='row'> \
        <div class='span2'> \
          <img src='{{=IMAGE_LINK}}' /> \
        </div> \
        <div class='span2'> \
          <p class='description'>{{=DESCRIPTION}}</p> \
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
            {{ITUNES}} \
              <li class='span1 link'> \
                <div class='thumbnail'> \
                  <a href='{{=ITUNES_URL}}'><img src='/static/images/itunes_icon.png' /></a> \
                  <div class='price'> \
                    {{=ITUNES_BUY}} \
                  </div> \
                </div> \
              </li> \
            {{/ITUNES}} \
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
  var overlayTmpl = new t(" \
    <div class='span10 hero-unit'> \
      <div class='row'> \
        <div class='span10'> \
          <h1>{{=title}}</h1> \
        </div> \
      </div> \
      <div class='row'> \
        <div class='span4'> \
          <img src='{{=imageBig}}' /> \
        </div> \
        <div class='span6'> \
          <p>{{=description}}</p> \
          <br> \
          " + icons(2) + " \
        </div> \
      </div> \
      <div class='clearfix'></div> \
    </div>");

  function icons(size) {
    return " \
          <ul class='thumbnails links'> \
            {{AMAZON}} \
              <li class='span" + size + " link'> \
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
              <li class='span" + size + " link'> \
                <div class='thumbnail'> \
                  <a href='{{=VUDU_URL}}'><img src='/static/images/vudu_icon.png' /></a> \
                  <div class='price'> \
                    {{=VUDU_RENT}} \
                  </div> \
                </div> \
              </li> \
            {{/VUDU_RENT}} \
            {{NETFLIX_AVAILABLE}} \
              <li class='span" + size + " link'> \
                <div class='thumbnail'> \
                  <a href='{{=NETFLIX_URL}}'><img src='/static/images/netflix_icon.png' /></a> \
                  <div class='price'> \
                    Free \
                  </div> \
                </div> \
              </li> \
            {{:NETFLIX_AVAILABLE}} \
            {{/NETFLIX_AVAILABLE}} \
            {{ITUNES}} \
              <li class='span" + size + " link'> \
                <div class='thumbnail'> \
                  <a href='{{=ITUNES_URL}}'><img src='/static/images/itunes_icon.png' /></a> \
                  <div class='price'> \
                    {{=ITUNES_BUY}} \
                  </div> \
                </div> \
              </li> \
            {{/ITUNES}} \
            {{VUDU_BUY}} \
              <li class='span" + size + " link'> \
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
          ";
  }
});
