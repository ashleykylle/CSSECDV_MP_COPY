# CSSECDV - Milestone 1
## Members:
- Dy, Fatima
- Jacinto, Jon Piolo
- Kimhoko, Jamuel Erwin
- Ramos, Ashley Kylle
## Prerequisites (versions used)
- [MySQL Server (ver. 8.0.36)](https://dev.mysql.com/get/Downloads/MySQLInstaller/mysql-installer-community-8.0.36.0.msi)
- [Node.js (ver. 21.6.1)](https://nodejs.org/dist/v21.6.1/node-v21.6.1-x64.msi)
## Deployment Instructions
### Setting Up MySQL (Database)
- Connect to your local instance of MySQL server and create a database named `hoadb`
- Ensure there is no `users` table in the database before the first run of the web application
### Create .env file
- Following the template from .env.example, create a separate .env file
- Fill up the missing details depending on your MySQL Server Setup
- **Note**: Default setup for local instances, `SQL_HOST="localhost"` | `SQL_USER="root"` | `SQL_PASSWORD=""`
### Running the web application
- Install node dependencies through the command `npm i` or `npm install`
- You can start the web application through the commands: `node app.js` | `npm run start` | `npm run dev` for nodemon
- To view the web application, go to http://localhost:PORT/ (**Note**: The localhost port depends on the `PORT` field in the .env file)
- For testing purposes, a default admin account is created at the first run of the web application (Email: `admin@user.com` Password: `admin123`)
