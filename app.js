const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const flash = require('connect-flash');
const session = require('express-session');
const app = express();
const path = require('path');

const db = require('./db');

//Controllers
const serjiaControl= require('./controllers/serjiaController');
const rewardsController = require('./controllers/rewardsController');

//Middleware
const {checkAuthentication, checkAdmin, checkUser} = require('./middleware/auth');
const {validateReg, validateLogin} = require('./middleware/validation');

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images'); // Directory to save uploaded files
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

// Set up view engine
app.set('view engine', 'ejs');
//  enable static files
app.use(express.static('public'));
// enable form processing
app.use(express.urlencoded({
    extended: false
}));
// Set up static directory
app.use(express.static(path.join(__dirname, 'public')));

//Code for Session Middleware  
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    // Session expires after 1 week of inactivity
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

app.use((req, res, next) => {
  console.log("Session staff:", req.session.staff);

  if (!req.session.staff) {
    res.locals.staff = null;
    return next();
  }

  const staffId = req.session.staff.staffID;

  const query = `
    SELECT staff.*, department.name AS department_name
    FROM staff
    JOIN department ON staff.department = department.departmentID
    WHERE staff.staffID = ?
  `;

  db.query(query, [staffId], (err, results) => {
    if (err) return next(err);

    console.log("DB Results:", results);

    if (results.length > 0) {
      res.locals.staff = results[0];
    } else {
      res.locals.staff = null;
    }

    console.log("res.locals.staff:", res.locals.staff);
    next();
  });
});


// Use connect-flash middleware
app.use(flash()); // Use flash middleware after session middleware

// Define routes here
app.get('/', serjiaControl.getSignIn);
app.post('/sign-in', validateLogin, serjiaControl.login);
app.get('/admin/register', checkAdmin, serjiaControl.getRegister);
app.post('/register', upload.single('profile'), validateReg, serjiaControl.register);
app.get('/logout', serjiaControl.logout);

//isabel routes
//admin routes
app.get('/rewards', rewardsController.viewRewards);
app.get('/rewards/read/:id', rewardsController.readReward);
app.get('/rewards/add', rewardsController.addRewardForm);
app.post('/rewards/add', upload.single('image'), rewardsController.addReward);
app.get('/rewards/edit/:id', rewardsController.editRewardForm);
app.post('/rewards/edit/:id', upload.single('image'), rewardsController.editReward);
//user routes
app.get('/user/rewards', rewardsController.userRewards);
app.get('/user/rewards/read/:id', rewardsController.readReward);
app.get('/reward/:id', rewardsController.viewSingleReward);
app.post('/claimReward/:id', rewardsController.claimReward);




//Start express servers
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}/`));


