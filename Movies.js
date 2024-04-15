var mongoose = require('mongoose'); // get the mongoose object
var Schema = mongoose.Schema; // get the schema object

const dbUrl = process.env.DB; // get the database URL from the environment variables

mongoose.connect(dbUrl, { // connect to the database
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false
})
    .then(() => console.log('MongoDB connected...'))
    .catch(err => console.log(err));

// Movie schema
const MovieSchema = new Schema({ // define the schema
    title: { type: String, required: true, index: true },
    releaseDate: Date,
    genre: {
        type: String,
        enum: [
            'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mystery', 'Thriller', 'Western', 'Science Fiction'
        ],
    },
    actors: [{
        actorName: String,
        characterName: String,
    }],
    imageUrl: String, // new field for storing the URL of a movie's image
});

// return the model
module.exports = mongoose.model('Movie', MovieSchema);