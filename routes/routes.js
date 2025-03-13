const express = require('express');
const validator = require('validator');

const router = express.Router();
const bcrypt = require('bcrypt');
const saltRounds = 12;

const data = require('../app');
var debug = false;

const winston = require('winston');
const { combine, timestamp, json} = winston.format;
const logger = winston.createLogger({
    transports: [
        new winston.transports.File({
            filename: './log/error.log',
            level: 'error',
            format: combine(timestamp(),json())
        }),
        new winston.transports.File({
            filename: './log/info.log',
            level: 'info',
            format: combine(timestamp(), json())
        })
    ]
})

const rateLimit = require('express-rate-limit');
const syslog = require("syslog-client");

const client = syslog.createClient("127.0.0.1");
const blockedIPs = new Map();

const limiter = rateLimit({ 
    windowMs: 15 * 60 * 1000, // 15 mins bago mag reset
    max: 5, // ONLY 5 ATTEMPTS MAX
    handler: (req, res) => {

        // check block time
        if (blockedIPs.has(req.ip)) {
            const resetDate = blockedIPs.get(req.ip);
            if (Date.now() < resetDate) {
                const resetTime = Math.ceil((resetDate - Date.now()) / 1000 / 60);
                return res.status(429).send(`Requested too many login attempts, try again in ${resetTime} minutes.`);
            } else {
                blockedIPs.delete(req.ip); // unblock IP after timeout
            }
        }

        // store IP with the reset time
        const resetDate = Date.now() + 15 * 60 * 1000;
        blockedIPs.set(req.ip, resetDate); 

        // calculate remaining block time
        const resetTime = Math.ceil((resetDate - Date.now()) / 1000 / 60);
        res.status(429).send(`Requested too many login attempts, try again in ${resetTime} minutes.`);
    },
    keyGenerator: (req) => req.ip,
    skipSuccessfulRequests: true
});

router.get('/', (req, res) => {
    res.redirect('/login');
});


router.get('/login', (req, res) => {
    // Doesn't store cache to avoid pressing back button even after login/logout
    res.setHeader('Cache-Control', 'no-store, must-revalidate');

    if (req.session.user) {
        res.redirect('/home');
    } else {
        res.render('login');
    }
});

router.get('/debugger', (req, res) => {
    debug = !debug;
    if(debug){
        console.log("Debug mode turned on.");
        logger.info("Debug mode turned on.");
    }
    else{
        console.log("Debug mode turned off");
        logger.info("Debug mode turned off.");
    }
    if(req.session.user){
        res.redirect('/home');
    }
    else{
        res.redirect('/login');
    }
   
});

// Match input credentials to database; still needs sessions and other security features
router.post('/login', limiter, async(req, res) => {
    // Doesn't store cache to avoid pressing back button even after login/logout
    res.setHeader('Cache-Control', 'no-store, must-revalidate');

    const remainingAttempts = res.getHeader('X-RateLimit-Remaining');

    const credentials = {
        email: req.body.email,
        password: req.body.password
    };

    try {
        // find user with email address
        req.db.query('SELECT * FROM users WHERE email = ?', [credentials.email], async (error, rows) => {
            if (error) {
                if(debug){
                    logger.error("SQL query error: ", error);
                }
                else{
                    logger.error("SQL query error");
                }
                return res.status(500).redirect('/login');
            }

            // check if email & password matches
            if (rows.length > 0) {
                const hashedPasswordFromDB = rows[0].password;

                // Compare the entered password with the hashed password from the database
                const passwordMatches = await bcrypt.compare(credentials.password, hashedPasswordFromDB);

                if (passwordMatches) {
                    req.session.user = { email: credentials.email, user_type: rows[0].user_type, id: rows[0].id, name: rows[0].name};   //NEWLY EDITED
                    res.redirect(`/home`);
                } else {
                    // Invalid email or password
                    client.log('Invalid email or password');
                    logger.error('Invalid email or password');
                    // Render the login page with an error message
                    if (remainingAttempts == 0) {
                        client.log("User requested too many login attempts.");
                        return res.status(401).render('login', { isDisabled: true, errorLogin: 'Invalid email or password', loginAttempts: `${remainingAttempts} remaining attempts. Try again later` });
                    } else {
                        return res.status(401).render('login', { errorLogin: 'Invalid email or password', loginAttempts: `${remainingAttempts} remaining attempts` });
                    }
                }
            } else {
                // Invalid email or password
                logger.error('Invalid email or password');
                // Render the login page with an error message
                if (remainingAttempts == 0) {
                    logger.log("User requested too many login attempts");
                    client.log("User requested too many login attempts.");
                    return res.status(401).render('login', { isDisabled: true, errorLogin: 'Invalid email or password', loginAttempts: `${remainingAttempts} remaining attempts. Try again later` });
                } else {
                    client.log(`Invalid email or password -- remaining attempts: ${remainingAttempts}`)
                    return res.status(401).render('login', { errorLogin: 'Invalid email or password', loginAttempts: `${remainingAttempts} remaining attempts` });
                }
                
            }
        });
    } catch (error) {
        if(debug){
            logger.error('Server error during login:', error);
        }
        else{
            logger.error("Server error during login.");
        }
        return res.status(500).send('Internal Server Error');
    }
});

// Redirects to register page
router.get('/register', (req, res) => {
    // Doesn't store cache to avoid pressing back button even after login/logout
    res.setHeader('Cache-Control', 'no-store, must-revalidate');

    if (req.session.user) {
        res.redirect('/home');
    } else {
        res.render('registration');
    }
});

const whiteSpaceRegex = /^\s*$/

// for file validation
const validImageTypes = {
    'image/jpeg': [0xff, 0xd8, 0xff, 0xe0], // JPG/JPEG magic numbers
    'image/png': [0x89, 0x50, 0x4e, 0x47]  // PNG magic numbers
};

const validateImage = (imageType, imageBuffer) => {
    if (!imageType || !imageBuffer) {
        return { isValid: false, message: 'Invalid image file.' };
    }

    const magicNumbers = validImageTypes[imageType];
    if (!magicNumbers) {
        return { isValid: false, message: 'Invalid image file. Upload a JPG/JPEG or PNG file.' };
    }

    if (imageBuffer.length < magicNumbers.length) {
        return { isValid: false, message: 'Invalid image file.' };
    }

    for (let i = 0; i < magicNumbers.length; i++) {
        if (magicNumbers[i] !== imageBuffer[i]) {
            return { isValid: false, message: 'Invalid image file. Upload a JPG/JPEG or PNG file.' };
        }
    }

    return { isValid: true };
};

// for strongpass validation
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{12,64}$/;

const phoneNumber = /^0{0,1}9[0-9]{9}$/;


// Create new user; TODO: input validation (including regex for email and phone) and file upload, password hashing, error messages (for wrong inputs)
router.post('/register', async(req, res) => {
    // Doesn't store cache to avoid pressing back button even after login/logout
    res.setHeader('Cache-Control', 'no-store, must-revalidate');

    const new_user = {
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
        phone: req.body.phone,
        image_name: req.file.originalname,
        image: req.file.buffer,
        imageType: req.file.mimetype
    }

    // handle input validation
    // for Full Name
    // if user enters empty string, whitespaces for name
    if (whiteSpaceRegex.test(new_user.name)) {
        logger.error('Invalid name. Name must not be an empty string or whitespaces');
        return res.status(400);
    }

    // for Email
    // using validator
    if (!validator.isEmail(new_user.email)) {
        logger.error('Invalid email format. Please enter a valid email address.');
        return res.status(400);
    }

    // for Password
    if (!strongPasswordRegex.test(new_user.password)) {
        logger.error('Invalid password. Password must be at least 12 characters long and include at least one lowercase letter, one uppercase letter, one number, and one special character.');
        return res.status(400);
    }

    // for Phone number
    if (!phoneNumber.test(new_user.phone)) {
        logger.error('Invalid phone number.');
        return res.status(400);
    } else {
        // fix format for saving in database (remove zeroes in the beginning)
        new_user.phone = parseInt(new_user.phone, 10).toString();
    }

    const imageType = req.file.mimetype;
    const imageBuffer = req.file.buffer;

    // for Profile Picture

    const validation = validateImage(imageType, imageBuffer);
        if (!validation.isValid) {
            logger.error('Invalid image type. Please upload a JPEG or PNG file.');
            return res.status(400).send(validation.message);
        }

    
    // Check if the image size is within the limit (1MB)
    if (req.file.size > 1024 * 1024) {
        logger.error('Invalid image size. Please upload an image with size less than or equal to 1MB.');
        return res.status(400).render('registration', 
        { name: new_user.name, email: new_user.email, password: new_user.password, phone: new_user.phone, regError: 'Invalid image size. Please upload an image with size less than or equal to 1MB' });
    }

    // Add user to database
   try {
    const hashedPassword = await bcrypt.hash(new_user.password, saltRounds);

    req.db.query('SELECT * FROM users WHERE email = ?', [new_user.email], async (error, rows) => {
        if (error) {
            if(debug){
                logger.error("SQL query error: ", error);
            }
            else{
                logger.error("SQL query error.");
            }
            
        }

        // add alert/error message
        if (rows.length > 0) {
            logger.error('Email already exists');
            return res.status(500).render('registration', 
            { name: new_user.name, email: new_user.email, password: new_user.password, phone: new_user.phone, regError: 'Email already exist!' });
        } else {

            new_user.phone = parseInt(new_user.phone, 10).toString();
            // Store the hashed password in the database
            req.db.query('INSERT INTO users (user_type, name, email, phone_no, password, image_name, image_data, image_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                ["DEFAULT", new_user.name, new_user.email, new_user.phone, hashedPassword, new_user.image_name, new_user.image, new_user.imageType]);
            logger.info("User registered successfully");
            client.log(`New user has registered: ${new_user.name}`);
            res.redirect('/login');
        }
    });
    
    } catch (error) {
        if(debug){
            logger.error('Error registering user: ', error);
        }
        else{
            logger.error('Error registering user');
        }
        
        return res.status(500).send('Internal Server Error');
    }
});

// delete selected user account
router.post('/delete/:id', async (req, res) => {
    // Doesn't store cache to avoid pressing back button even after logout
    res.setHeader('Cache-Control', 'no-store, must-revalidate');

    if (req.session.user && req.session.user.user_type == "ADMIN") {
    
        const id = req.params.id;
        try {
            req.db.query('DELETE FROM users WHERE id = ?', [id], (error, users) => {
                if (error) {
                    if(debug){
                        logger.error('SQL query error: ', error);
                    }
                    else{
                        logger.error('SQL query error.');
                    }
                    return res.redirect('/adminDelete');
                } else {
                    logger.info(`User ID ${id} deleted successfully`);
                    client.log(`User ID ${id} deleted successfully`);
                    res.redirect('/adminDelete');
                }
            });
        } catch (error) {
            if(debug){
                logger.error('Error deleting user data: ', error);
            }
            else{
                logger.error("Error deleting user data.");
            }
        }

    } else {
        res.redirect('/login');
    }

})

// delete selected user account
router.post('/update/:id', async (req, res) => {
    // Doesn't store cache to avoid pressing back button even after logout
    res.setHeader('Cache-Control', 'no-store, must-revalidate');

    if (req.session.user && req.session.user.user_type == "ADMIN") {
    
        const id = req.params.id;
        const user_type = req.body.user_type;

        try {
            req.db.query('UPDATE users SET user_type = ? WHERE id = ?', [user_type, id], (error, users) => {
                if (error) {
                    if(debug){
                        logger.error('SQL query error: ', error);
                    }else{
                        logger.error('SQL query error');
                    }
                    return res.redirect('/adminUpdate');
                } else {
                    logger.info(`User ID ${id}'s role updated successfully`);
                    client.log(`User ID ${id}'s role updated successfully`);
                    res.redirect('/adminUpdate');
                }
            });
        } catch (error) {
            if(debug){
                logger.error('Error updating user data: ', error);
            } else{
                logger.error('Error updating user data.');
            }
        }

    } else {
        res.redirect('/login');
    }

})

// default home after login
router.get('/home', (req, res) => {
    // Doesn't store cache to avoid pressing back button even after logout
    res.setHeader('Cache-Control', 'no-store, must-revalidate');

    if (req.session.user) {

        let isAdmin = req.session.user.user_type === "ADMIN";

        try {
            req.db.query(`SELECT id, name, image_data, image_type FROM users WHERE email = '${req.session.user.email}' `, (error, users) => {
                if (error) {
                    logger.error('SQL query error: ', error);
                    return res.redirect('/login');
                } else {
                    logger.info(`User ${users[0].id} logged in successfully`);
                    client.log("User logged in with ID ", users[0].id);
                    fullName = users[0].name
                    image = Buffer.from(users[0].image_data, 'binary').toString('base64');

                    imageType =  users[0].image_type
                    res.render('home', { fullName, imageType, image, isAdmin, data });

                }
            });
        } catch (error) {
            logger.error('Error loading home page: ', error);
        }

    } else {
        res.redirect('/login');
    }

});

router.get('/adminDelete', (req, res) => {
    // Doesn't store cache to avoid pressing back button even after login/logout
    res.setHeader('Cache-Control', 'no-store, must-revalidate');

    if (req.session.user) {
        if (req.session.user.user_type == "ADMIN"){
            try {
                req.db.query(`SELECT id, name, email, user_type FROM users WHERE id != 1 AND name != 'admin' `, (error, users) => {
                    if (error) {
                        logger.error('SQL query error: ', error);
                        return res.redirect('/login');
                    } else {
                        logger.info("Admin delete triggered");
                        client.log("Admin delete triggered");
                        res.render('adminDelete', { users: users });
                    }
                });

            } catch (error) {
                logger.error('Error fetching user data: ', error);
            }

        } else {

            return res.redirect('/home');
            
        }
    } else {
        res.redirect('/login');
    }
});

router.get('/adminUpdate', (req, res) => {
    // Doesn't store cache to avoid pressing back button even after login/logout
    res.setHeader('Cache-Control', 'no-store, must-revalidate');

    if (req.session.user) {
        if (req.session.user.user_type == "ADMIN"){
            try {
                req.db.query(`SELECT id, name, email, user_type FROM users WHERE id != 1 AND name != 'admin' `, (error, users) => {
                    if (error) {
                        client.log("SQL query error: ", error);
                        logger.error('SQL query error: ', error);
                        return res.redirect('/login');
                    } else {
                        logger.info("Admin update triggered");
                        client.log("Admin Update triggered");
                        res.render('adminUpdate', { users: users });
                    }
                });

            } catch (error) {
                logger.error('Error fetching user data: ', error);
            }

        } else {

            return res.redirect('/home');
            
        }
    } else {
        res.redirect('/login');
    }
});

//NEWLY ADDED
router.post('/createPost', async(req, res) => {
    // Doesn't store cache to avoid pressing back button even after login/logout
    res.setHeader('Cache-Control', 'no-store, must-revalidate');

    if (req.session.user) {
        const new_post = {
            user_id: req.session.user.id,
            user_type: req.session.user.user_type,
            name: req.session.user.name,
            user_post: req.body.user_post
        }
        
        if (req.session.user.user_type == "DEFAULT"){
            try {
                req.db.query('INSERT INTO posts (id, user_type, name, user_post) VALUES (?, ?, ?, ?)',
                [new_post.user_id, new_post.user_type, new_post.name, new_post.user_post], (error, users) => {
                    if (error) {
                        console.error('SQL query error: ', error);
                        return res.redirect('/home');
                    } else {
                        console.log(`debug: ${new_post.user_id}, ${new_post.user_type}, ${new_post.name}, ${new_post.user_post}`)
                        res.redirect('home');
                    }
                });

            } catch (error) {
                console.error('Error fetching user data: ', error);
            }

        } else {

            return res.redirect('/home');
            
        }
    } else {
        res.redirect('/login');
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

router.post('/logout', (req, res) => {
    logger.info("Destroyed previous session");
    req.session.destroy();
    res.redirect('/login');
});

// Catch-all route for unknown URLs
router.get('*', (req, res) => {
    res.render('errorPage');
});


//Session Expiry: session will expire after 10 minutes.
//middleware to check session expiry 
const sessionExpiryChecker = (req, res, next) => {
    if(!req.session.user) {
        return res.redirect('/login');
    }
    next();
};

//10 mins. session expiry is implemented on all pages except log in and register
router.use(['/home', '/adminDelete', '/adminUpdate'], sessionExpiryChecker);

module.exports = router;


//SQL QUERY FOR posts table (IN MYSQL)
/*
CREATE TABLE IF NOT EXISTS posts (
    post_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    id INT,
    user_type VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    user_post VARCHAR(255),
    FOREIGN KEY (id) REFERENCES users(id)
    );
*/