// Load environment variables
require('dotenv').config();

const path = require('path');

// express
const express = require('express');

// express-session
const session = require('express-session');

const app = express();

// set session middleware
app.use(session({
    secret: '@the_hoadb-really+secret.session=key!',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 10 * 60 * 1000 } // 10 minutes
}));

// set up JSON body parsing
app.use(express.static(__dirname));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// multer for file uploads in form
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
app.use(upload.single('profile-photo'));


// express-hbs
const exphbs = require('express-handlebars');

// routes
const routes = require('./routes/routes.js');

// sql database
const user_db = require('./models/userSchema.js');
app.use((req, _, next) => {
    req.db = user_db; // Inject the database connection into req object
    next();
});

const db = user_db;

// set PORT
const port = process.env.PORT;

var syslog = require("syslog-client");

// express-hbs setup
app.engine('hbs', exphbs.engine({ 
    extname: 'hbs', 
    partialsDir: '',
    layoutsDir: '',
    defaultLayout: ''
}));
app.set('view engine', 'hbs');

// static assets folder
app.use(express.static('public'));

const rateLimit = require('express-rate-limit');

const limiter = rateLimit({ 
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Max 5 attempts
    keyGenerator: (req) => req.ip, 
    skipSuccessfulRequests: true
});

// Apply limiter to all routes
app.use(limiter);

// router
app.use('/', routes);
var options = {
    transport: syslog.Transport.Udp,
    port: 514
};
var client = syslog.createClient("172.23.160.1", options);

app.listen(port, () => {
    client.log(`Listening on port ${port}`)
});
db.query('SELECT * FROM posts', function (error, results, fields) {
    if (error) throw error;
    else {
        var sqlData = [];
        for (i = 0; i < results.length; i++) {
            if (results[i].hasOwnProperty("post_id" && "user_type" && "name" && "user_post")) {
                let sqlRow = {
                    id: results[i].post_id,
                    type: results[i].user_type,
                    user: results[i].name,
                    post: results[i].user_post
                }
                sqlData.push(sqlRow);
            }
        }
        exports.data = sqlData;
    }
});