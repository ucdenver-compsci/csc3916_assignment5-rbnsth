/*
CSC3916 HW4
File: Server.js
Description: Web API scaffolding for Movie API
 */

// Load required packages
var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var authController = require('./auth');
var authJwtController = require('./auth_jwt');
var jwt = require('jsonwebtoken');
var cors = require('cors');
var User = require('./Users');
var Movie = require('./Movies');
var Review = require('./Reviews');
var crypto = require('crypto');
const e = require('express');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
var app = express(); // Initialize the Express app
app.use(cors()); // Enable All CORS Requests
app.use(bodyParser.json()); // Use the body-parser package in our application
app.use(bodyParser.urlencoded({ extended: false }));
app.use(passport.initialize());
var router = express.Router();
const measurementId = process.env.MEASUREMENT_ID; // GA4 measurement ID
const apiSecret = process.env.API_KEY; // GA4 API secret

async function sendEventToGA4(eventName, params) { // Send an event to GA4
    const payload = {
        client_id: crypto.randomBytes(16).toString("hex"), // A unique client ID
        events: [{
            name: eventName,
            params: params,
        }],
    };

    // Send the event to GA4
    const response = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`, {
        method: 'POST',
        body: JSON.stringify(payload), // Convert the payload to a JSON string
        headers: { 'Content-Type': 'application/json' }, // Set the Content-Type header to application/json
    });

    if (!response.ok) {
        throw new Error(`Failed to send event to GA4. Status: ${response.status}`);
    }

    console.log('Event sent to GA4 successfully.');
}

function getJSONObjectForMovieRequirement(req) { // Get a JSON object for the movie requirement
    var json = {
        headers: "No headers",
        key: process.env.UNIQUE_KEY,
        body: "No body"
    };
    // Check if the request has a body or headers
    if (req.body != null) {
        json.body = req.body;
    }
    if (req.headers != null) {
        json.headers = req.headers;
    }

    return json;
}

router.post('/signup', function (req, res) { // new /signup endpoint
    // Check if the request includes a username and password
    if (!req.body.username || !req.body.password) {
        res.json({ success: false, msg: 'Please include both username and password to signup.' })
    } else { // Create a new user
        var user = new User();
        user.name = req.body.name;
        user.username = req.body.username;
        user.password = req.body.password;

        user.save(function (err) { // Save the user
            if (err) {
                if (err.code == 11000)
                    return res.json({ success: false, message: 'A user with that username already exists.' });
                else
                    return res.json(err);
            }

            res.json({ success: true, msg: 'Successfully created new user.' })
        });
    }
});

router.post('/signin', function (req, res) { // new /signin endpoint
    var userNew = new User();
    userNew.username = req.body.username;
    userNew.password = req.body.password;

    // Find the user by username
    User.findOne({ username: userNew.username }).select('name username password').exec(function (err, user) {
        if (err) {
            res.send(err);
        }

        // Check if user exists before comparing password
        if (user) {
            user.comparePassword(userNew.password, function (isMatch) {
                if (isMatch) { // Create a token if the password matches
                    var userToken = { id: user.id, username: user.username };
                    var token = jwt.sign(userToken, process.env.SECRET_KEY);
                    res.json({ success: true, token: 'JWT ' + token });
                }
                else { // Send an error if the password doesn't match
                    res.status(401).send({ success: false, msg: 'Authentication failed.' });
                }
            });
        } else { // Send an error if the user doesn't exist
            res.status(401).send({ success: false, msg: 'Authentication failed. User not found.' });
        }
    })
});

router.route('/movies/:id?') // new /movies endpoint
    .get(authJwtController.isAuthenticated, (req, res) => {
        let query = {};
        // Check if an ID was provided
        if (req.params.id) {
            let id;
            try {
                id = mongoose.Types.ObjectId(req.params.id); // Try to convert to ObjectId
            } catch (error) {
                id = req.params.id; // Use as string if conversion fails
            }
            query = { $or: [{ _id: id }, { title: id }] }; // Search by _id or title
        } else if (req.query.title) {
            // If no ID but there's a title query param, use it for filtering
            query.title = req.query.title;
        }
        if (req.query.reviews === 'true') { // Check if the reviews query param is true
            Movie.aggregate([
                { $match: query },
                {
                    $lookup: {
                                from: "reviews",
                                localField: "_id",
                                foreignField: "movieId",
                                as: "reviews"
                            }
                },
                {
                    $addFields: { // Add a new field to the document
                        avgRating: { $avg: "$reviews.rating" }
                    }
                },
                { $sort: { avgRating: -1 } } // Sort by avgRating in descending order
            ]).exec(function (err, result) { // Execute the aggregation
                if (err) { // Send an error if there's an error
                    res.send(err);
                } else {
                    res.json(result); // result could be either a single movie or an array of movies
                }
            });
        } else {
            Movie.find(query, (err, result) => { // Find the movie(s) based on the query
                if (err) { // Send an error if there's an error
                    return res.status(500).send(err);
                }
                res.json(result); // result could be either a single movie or an array of movies
            });
        }
    })
    .post(authJwtController.isAuthenticated, (req, res) => { // Create a new movie
        if (!req.body.title || !req.body.releaseDate || !req.body.genre || !req.body.actors) {
            res.json({ success: false, msg: 'Please include all required fields: title, releaseDate, genre, and actors.' });
        } else { // Save the movie
            var movie = new Movie(); // Create a new movie
            movie.title = req.body.title;
            movie.releaseDate = req.body.releaseDate;
            movie.genre = req.body.genre;
            movie.actors = req.body.actors;

            movie.save((err) => { // Save the movie
                if (err) res.status(500).send(err);
                res.json({ success: true, msg: 'Successfully created new movie.' });
            });
        }
    })
    .put(authJwtController.isAuthenticated, (req, res) => { // Update a movie
        Movie.findOneAndUpdate({ title: req.body.title }, req.body, { new: true }, (err, movie) => { // Find and update the movie
            if (err) res.status(500).send(err);
            res.json({ success: true, msg: 'Successfully updated movie.' });
        });
    })
    .delete(authController.isAuthenticated, (req, res) => { // Delete a movie
        Movie.findOneAndDelete({ title: req.body.title }, (err) => {
            if (err) res.status(500).send(err);
            res.json({ success: true, msg: 'Successfully deleted movie.' });
        }); // Find and delete the movie
    })
    .all((req, res) => { // Handle unsupported methods
        res.status(405).send({ status: 405, message: 'HTTP method not supported.' });
    }); 

// new /search endpoint (extra credit)
router.post('/search', (req, res) => { 
    // use regex to find movies with titles or actors that match the search query
    const searchTerm = req.body.searchTerm;
    const regex = new RegExp(searchTerm, 'i'); // 'i' makes it case insensitive

    Movie.find({
        $or: [
            { title: regex },
            { 'actors.actorName': regex }
        ]
    })
    .then(movies => res.json(movies))
    .catch(err => res.status(500).json({ error: err }));
});


// Routes for creating, getting, and deleting reviews using Express router and MongoDB with Mongoose.
// route to create a review
router.post('/reviews', function (req, res) {
    if (!req.body.movieId || !req.body.username || !req.body.review || !req.body.rating) {
        return res.status(400).json({ success: false, msg: 'Please include all required fields: movieId, username, review, and rating.' });
    }

    var review = new Review();
    review.movieId = req.body.movieId;
    review.username = req.body.username;
    review.review = req.body.review;
    review.rating = req.body.rating;

    review.save(function (err) { // Save the review
        if (err) {
            return res.status(500).send(err);
        }
        sendEventToGA4('review', getJSONObjectForMovieRequirement(req)); // Send an event to GA4
        return res.status(201).json({ message: 'Review created!' });
    });
});

router.get('/reviews', function (req, res) { // Get all reviews
    if (req.query.movieId) { // Get reviews by movie ID
        let movieId = req.query.movieId.trim(); // Trim the movie ID
        Review.find({ movieId: movieId }, function (err, reviews) { // Find reviews by movie ID
            if (err) { // Send an error if there's an error
                return res.status(500).send(err);
            }
            return res.status(200).json(reviews);
        });
    } else if (req.query.reviewId) { // Get a review by review ID
        let reviewId = req.query.reviewId.trim();
        Review.findById(reviewId, function (err, review) {
            if (err) {
                return res.status(500).send(err);
            }
            return res.status(200).json(review);
        });
    } else { // Get all reviews
        Review.find(function (err, reviews) {
            if (err) {
                return res.status(500).send(err);
            }
            return res.status(200).json(reviews);
        });
    }
});


app.use('/', router);
const port = process.env.PORT || 8000;
app.listen(port, () => {
    console.log('Server listening on port ' + port);
})
module.exports = app; // for testing only
