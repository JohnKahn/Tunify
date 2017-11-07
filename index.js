/**
 * This is an example of a basic node.js script that performs
 * the Authorization Code oAuth2 flow to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/web-api/authorization-guide/?authorization_code_flow
 */

const express = require('express'); // Express web server framework
const bodyParser = require('body-parser');
const request = require('request'); // "Request" library
const querystring = require('querystring');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const fs = require('fs');

const Playlist = require('./playlist');

mongoose.connect(
  'mongodb://tunify:Qc3PU7zyt8U49K2pVyRS4xD8QM8O1cwFWmM8O76PvIlMiHMifZZMAFbXN5QMp8WdKe5368jd6v7MAdqlxqpG0w==@tunify.documents.azure.com:10255/?ssl=true',
  {
    useMongoClient: true,
  }
);
mongoose.Promise = global.Promise;

const client_id = 'd4787ada2aae418e8719bb5d540c3194'; // Your client id
const client_secret = '0f05ff110d9e41c281ce2ee71cb23f78'; // Your secret
const redirect_uri = 'https://tunify.azurewebsites.net/callback'; // Your redirect uri
// const redirect_uri = 'http://localhost:3000/callback'; // Your redirect uri

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function(length) {
  var text = '';
  var possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';

var app = express();
app.set('view engine', 'pug');
app.use(express.static(__dirname + '/public'));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/', function(req, res) {
  res.render('index', req.query);
});

app.get('/app', function(req, res) {
  let { access_token, refresh_token, user_id } = req.query;
  if (!access_token || !refresh_token || !user_id) {
    return res.redirect(
      '/?' +
        querystring.stringify({
          error: 'invalid_access_token',
        })
    );
  }

  request.post(
    {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        refresh_token,
        grant_type: 'refresh_token',
      },
      headers: {
        Authorization:
          'Basic ' +
          new Buffer(client_id + ':' + client_secret).toString('base64'),
      },
      json: true,
    },
    function(error, response, body) {
      if (!error && response.statusCode === 200) {
        var access_token = body.access_token,
          refresh_token = body.refresh_token;

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { Authorization: 'Bearer ' + access_token },
          json: true,
        };

        // use the access token to access the Spotify Web API
        request.get(options, function(error, response, body) {
          Playlist.find().then(docs => {
            res.render('app', {
              access_token: access_token,
              refresh_token: refresh_token,
              user_id: body.id,
              playlists: docs,
            });
          });
        });
      } else {
        res.redirect(
          '/?' +
            querystring.stringify({
              error: 'invalid_token',
            })
        );
      }
    }
  );
});

app.post('/playlist', function(req, res) {
  let {
    name,
    description,
    latitude,
    longitude,
    access_token,
    user_id,
  } = req.body;

  request.post(
    {
      url: `https://api.spotify.com/v1/users/${user_id}/playlists`,
      body: {
        name,
        public: false,
        collaborative: true,
        description,
      },
      headers: {
        Authorization: 'Bearer ' + access_token,
      },
      json: true,
    },
    function(err, response, body) {
      Playlist.create({
        name,
        description,
        score: 1,
        radius: 200,
        latitude,
        longitude,
        isPoly: false,
        isLarge: false,
        spotifyId: body.id,
        userId: user_id,
      }).then(() => {
        res.json({
          success: true,
        });
      });
    }
  );
});

app.get('/login', function(req, res) {
  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope =
    'user-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private';
  res.redirect(
    'https://accounts.spotify.com/authorize?' +
      querystring.stringify({
        response_type: 'code',
        client_id: client_id,
        scope: scope,
        redirect_uri: redirect_uri,
        state: state,
      })
  );
});

app.get('/callback', function(req, res) {
  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect(
      '/?' +
        querystring.stringify({
          error: 'state_mismatch',
        })
    );
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code',
      },
      headers: {
        Authorization:
          'Basic ' +
          new Buffer(client_id + ':' + client_secret).toString('base64'),
      },
      json: true,
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        var access_token = body.access_token,
          refresh_token = body.refresh_token;

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { Authorization: 'Bearer ' + access_token },
          json: true,
        };

        // use the access token to access the Spotify Web API
        request.get(options, function(error, response, body) {
          res.redirect(
            '/app?' +
              querystring.stringify({
                access_token: access_token,
                refresh_token: refresh_token,
                user_id: body.id,
              })
          );
        });
      } else {
        res.redirect(
          '/?' +
            querystring.stringify({
              error: 'invalid_token',
            })
        );
      }
    });
  }
});

app.get('/refresh_token', function(req, res) {
  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: {
      Authorization:
        'Basic ' +
        new Buffer(client_id + ':' + client_secret).toString('base64'),
    },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token,
    },
    json: true,
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        access_token: access_token,
      });
    }
  });
});

let port = process.env.PORT || 80;
console.log('Listening on ' + port);
app.listen(port);
