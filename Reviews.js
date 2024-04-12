var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// Review schema
var ReviewSchema = new Schema({
    movieId: { type: Schema.Types.ObjectId, ref: 'Movie' },
    username: String,
    review: String,
    rating: { type: Number, min: 0, max: 5 }
});

// return the model
module.exports = mongoose.model('Review', ReviewSchema);