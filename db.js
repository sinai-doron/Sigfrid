/**
 * Created by Doron Sinai on 23/10/2014.
 */
var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');
var showSchema = new mongoose.Schema({
    _id: Number,
    name: String,
    airsDayOfWeek: String,
    airsTime: String,
    firstAired: Date,
    genre: [String],
    network: String,
    overview: String,
    rating: Number,
    ratingCount: Number,
    status: String,
    poster: String,
    url: String,
    subscribers: [{
        type: mongoose.Schema.Types.ObjectId, ref: 'User'
    }],
    episodes: [ {type: mongoose.Schema.Types.ObjectId, ref: 'Episode'} ]
});

var episodeSchema = {
    episodeId:String,
    showId: Number,
    showName: String,
    season: Number,
    episodeNumber: Number,
    episodeName: String,
    firstAired: Date,
    overview: String,
    watched: Boolean,
    absoluteNumber:Number,
    imageLocation:String,
    thumbHeight:Number,
    thumbWidth:Number
}

var userSchema = new mongoose.Schema({
    email: { type: String, unique: true },
    password: String
});

userSchema.pre('save', function(next) {
    var user = this;
    if (!user.isModified('password')) return next();
    bcrypt.genSalt(10, function(err, salt) {
        if (err) return next(err);
        bcrypt.hash(user.password, salt, function(err, hash) {
            if (err) return next(err);
            user.password = hash;
            next();
        });
    });
});

userSchema.methods.comparePassword = function(candidatePassword, cb) {
    bcrypt.compare(candidatePassword, this.password, function(err, isMatch) {
        if (err) return cb(err);
        cb(null, isMatch);
    });
};

mongoose.model('User', userSchema);
mongoose.model('Show', showSchema);
mongoose.model('Episode', episodeSchema);

var options = {
    server: { poolSize: 5 }
}
mongoose.connect('mongodb://localhost/tvdb',options);