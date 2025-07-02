const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const flash = require('connect-flash');
const session = require('express-session');
const app = express();
const path = require('path');

const db = require('./db');

// Controllers
const serjiaControl = require('./controllers/serjiaController');
const isabelControl = require('./controllers/isabelController');
const nikiController= require('./controllers/nikiController');
const alyshaControl= require('./controllers/alyshaController')

// Middleware
const { checkAuthentication, checkAdmin, checkUser } = require('./middleware/auth');
const { validateReg, validateLogin, validatePasswordChange } = require('./middleware/validation');


// Multer config
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
app.use(express.static(path.join(__dirname, 'FYP_Project-main/public')));

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

//Ser Jia
app.get('/', serjiaControl.getSignIn);
app.post('/sign-in', validateLogin, serjiaControl.login);
app.get('/admin/register', checkAuthentication, checkAdmin, serjiaControl.getRegister);
app.post('/register', checkAuthentication, checkAdmin, upload.single('profile'), validateReg, serjiaControl.register);
app.get('/admin/dashboard', checkAuthentication, checkAdmin, serjiaControl.getAdmin);
app.get('/logout', checkAuthentication, serjiaControl.logout);
app.post('/status/:staffID', checkAuthentication, checkAdmin, serjiaControl.updateStatus);
app.get('/user/profile', checkAuthentication, serjiaControl.getEditDetail);
app.get('/user/change-password', checkAuthentication, serjiaControl.getChangePassword);
app.post('/user/change-password', checkAuthentication, validatePasswordChange, serjiaControl.postChangePassword);
app.post('/editStaff/:staffID', checkAdmin, upload.single('profile_image'), serjiaControl.editStaff);
app.post('/user/edit-particulars', serjiaControl.editParticulars)

// Isabel's reward routes (admin only)
app.get('/admin/rewards', checkAuthentication, checkAdmin, isabelControl.viewRewards);
app.get('/admin/rewards/read/:id', checkAuthentication, checkAdmin, isabelControl.readReward);
app.get('/admin/rewards/add', checkAuthentication, checkAdmin, isabelControl.addRewardForm);
app.post('/rewards/add', checkAuthentication, checkAdmin, upload.single('image'), isabelControl.addReward);
app.get('/rewards/edit/:id', checkAuthentication, checkAdmin, isabelControl.editRewardForm);
app.post('/rewards/edit/:id', checkAuthentication, checkAdmin, upload.single('image'), isabelControl.editReward);

// User reward routes (user only)
app.get('/user/rewards', checkAuthentication, checkUser, isabelControl.userRewards);
app.get('/rewards/read/:id', checkAuthentication, checkUser, isabelControl.readReward);
app.get('/reward/:id', checkAuthentication, checkUser, isabelControl.viewSingleReward);
app.post('/claimReward/:id', checkAuthentication, checkUser, isabelControl.claimReward);

// Niki's user and admin leaderboard routes
app.get('/user/dashboard', checkAuthentication, checkUser, nikiController.getUserDashboard);
app.get('/user/leaderboard', checkAuthentication, checkUser, nikiController.getUserLeaderboard);
app.get('/admin/leaderboard', checkAuthentication, checkAdmin, nikiController.getAdminLeaderboard);
app.get('/admin/leaderboard/add', checkAuthentication, checkAdmin, nikiController.getAddLeaderboardEntry);
app.post('/admin/leaderboard/add', checkAuthentication, checkAdmin, nikiController.postAddLeaderboardEntry);
app.get('/admin/leaderboard/edit/:id', checkAuthentication, checkAdmin, nikiController.getEditLeaderboardEntry);
app.post('/admin/leaderboard/edit/:id', checkAuthentication, checkAdmin, nikiController.postEditLeaderboardEntry);
app.post('/admin/leaderboard/delete/:id', checkAuthentication, checkAdmin, nikiController.deleteLeaderboardEntry);


// Alysha's program routes
app.get('/admin/programs', checkAuthentication, checkAdmin, alyshaControl.getProgramsAdmin);
app.get('/user/programs', checkAuthentication, checkUser, alyshaControl.getProgramsUser);

app.post('/programs/delete/:id', checkAuthentication, checkAdmin, alyshaControl.deleteProgram);

app.get('/programs/add', checkAuthentication, checkAdmin, alyshaControl.getAddProgram);
app.post('/programs/add', checkAuthentication, checkAdmin, upload.single('qr_code'), alyshaControl.postAddProgram);

app.get('/programs/edit/:id', checkAuthentication, checkAdmin, alyshaControl.getEditProgram);
app.post('/programs/edit/:id', checkAuthentication, checkAdmin, alyshaControl.postEditProgram);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}/`));
