const mongoose = require('mongoose');

const PlaylistSchema = mongoose.Schema({
  name: String,
  description: String,
  score: Number,
  radius: Number,
  latitude: Number,
  longitude: Number,
  spotifyId: String,
  userId: String,
});

const Playlist = mongoose.model('Playlist', PlaylistSchema);

module.exports = {
  Playlist
};