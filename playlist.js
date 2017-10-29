const mongoose = require('mongoose');

const PlaylistSchema = mongoose.Schema({
  name: String,
  description: String,
  score: Number,
  isPoly: Boolean,
  isLarge: Boolean,
  polygon: [[Number]],
  radius: Number,
  latitude: Number,
  longitude: Number,
  imageUrl: String,
  spotifyId: String,
  userId: String,
});

const Playlist = mongoose.model('Playlist', PlaylistSchema);

module.exports = Playlist;