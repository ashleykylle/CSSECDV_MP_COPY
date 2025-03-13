// Contains connection to MySQL and User Account Schema
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const saltRounds = 12;


// Create MySQL Connection
const connection = mysql.createConnection({
    host: process.env.SQL_HOST,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: "hoadb"
});

// User Account Table Schema
const createUserTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_type VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone_no VARCHAR(10),
    image_name VARCHAR(255),
    image_data LONGBLOB,
    image_type VARCHAR(255)
    )`;

const fs = require('fs');
const path = require('path');

// Read the image file
const imagePath = path.join(__dirname, '..', 'public', 'images', 'johncena.jpg');
console.log(imagePath)
const imageBuffer = fs.readFileSync(imagePath);

// Get the image type (assuming it's jpg)
const imageType = 'image/jpg';


// Default Admin Account; Need to Hash Password
const defaultAdminQuery = `
        INSERT INTO users (user_type, name, email, phone_no, password, image_name, image_data, image_type) 
            SELECT 'ADMIN', 'admin', 'admin@user.com', 9672890215, ?, 'johncena.jpg', ?, '${imageType}'
            WHERE NOT EXISTS (
                SELECT 1 FROM users WHERE email = 'admin@user.com'
            )
        `;

// Hash the default admin password before inserting it into the database
const hashedDefaultAdminPassword = bcrypt.hashSync('admin123', saltRounds);

connection.query(createUserTableQuery, (error) => {
    if (error) {
        console.log("Creating user table FAILED: ", error);
        return;
    }
    console.log("Successful creation of user table or is existing");

    connection.query(defaultAdminQuery, [hashedDefaultAdminPassword, imageBuffer], (error) => {
        if (error) {
            console.log("Error creating default admin: ", error);
        }
        console.log("Successful creation of default admin user or is existing");
    })
});


module.exports = connection;
