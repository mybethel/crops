var http = require('http')
  , https = require('https')
  , url = require('url')
  , gm = require('gm');

module.exports = function(basePath, placeholder) {
  var parsedBasePath = url.parse(basePath)
    , get = parsedBasePath.protocol === 'https:' ? https.get : http.get;

  return http.createServer(function(req, res) {
    var imageStream
      , params = parseParams(req.url)
      , options = {
          hostname: parsedBasePath.hostname,
          port: parsedBasePath.port,
          path: (parsedBasePath.path + params.imagePath).replace('//', '/')
        };

    get(options, function(r) {
      if (r.statusCode !== 200) {
        // Catch a non-200 response and process with placeholder image if provided.
        if (placeholder && placeholder[r.statusCode]) {
          options.path = (parsedBasePath.path + placeholder[r.statusCode]).replace('//', '/');
          get(options, function(r) {
            // If the placeholder image fails to load, give up now.
            if (r.statusCode !== 200) {
              r.pipe(res);
              return;
            }

            processFileOutput(r, params, res);
          });
        } else {
          res.statusCode = r.statusCode;
          r.pipe(res);
          return;
        }
      } else {  
        processFileOutput(r, params, res);
      }
    });
  });
}

function processFileOutput(r, params, res) {
  if (!params.size)
    return r.pipe(res);

  res.writeHeader(200, {"Cache-Control": "max-age=600"});

  imageStream = gm(r);

  // Maintain aspect ratio if only provided the image width
  if (!params.size.height) {
    imageStream
      .resize(params.size.width);
  }

  // Otherwise resize and crop the image
  else {
    imageStream
      .resize(params.size.width, params.size.height, '^')
      .gravity('Center')
      .crop(params.size.width, params.size.height);
  }

  imageStream
    .stream()
    .pipe(res);
}

var widthRegex = /^\/(\d+)*\//
  , widthHeightRegex = /^\/(\d+)x?(\d+)*\//

function parseParams(url) {
  var params = {
        imagePath: url.replace(widthRegex, '/').replace(widthHeightRegex, '/')
      }
    , sizeMatch;

  if (sizeMatch = url.match(widthRegex)) {
    params.size = {
      width: sizeMatch[1]
    };
  }
  else if (sizeMatch = url.match(widthHeightRegex)) {
    params.size = {
      width: sizeMatch[1],
      height: sizeMatch[2]
    };
  }

  return params;
}