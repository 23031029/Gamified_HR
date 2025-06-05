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

// Middleware
const { checkAuthentication, checkAdmin, checkUser } = require('./middleware/auth');
const { validateReg, validateLogin } = require('./middleware/validation');


// Multer config
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/images'),
    filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage: storage });

// View engine and static
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// Session setup
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 1 week
}));

// Load user/admin into res.locals
app.use((req, res, next) => {
  console.log("Session staff:", req.session.staff);

  if (!req.session.staff) {
    res.locals.staff = null;
    res.locals.admin = null;
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
      const user = results[0];
      if (user.role === 'admin') {
        res.locals.admin = user;
        res.locals.staff = null;
      } else {
        res.locals.staff = user;
        res.locals.admin = null;
      }
    } else {
      res.locals.staff = null;
      res.locals.admin = null;
    }

    console.log("res.locals.staff:", res.locals.staff);
    console.log("res.locals.admin:", res.locals.admin);
    next();
  });
});

// Flash
app.use(flash());

// Public routes
app.get('/', serjiaControl.getSignIn);
app.post('/sign-in', validateLogin, serjiaControl.login);
app.get('/admin/register', checkAdmin, serjiaControl.getRegister);
app.post('/register', upload.single('profile'), validateReg, serjiaControl.register);
app.get('/admin/dashboard', checkAdmin, checkAuthentication, serjiaControl.getAdmin);
app.get('/logout', serjiaControl.logout);
app.post('/status/:staffID', serjiaControl.updateStatus);
app.get('/user/profile',checkAuthentication, serjiaControl.getEditDetail);
app.get('/user/change-password', serjiaControl.getChangePassword);
app.post('/user/change-password', serjiaControl.postChangePassword);

// Isabel's reward routes
app.get('/rewards', isabelControl.viewRewards);
app.get('/rewards/read/:id', isabelControl.readReward);
app.get('/rewards/add', isabelControl.addRewardForm);
app.post('/rewards/add', upload.single('image'), isabelControl.addReward);
app.get('/rewards/edit/:id', isabelControl.editRewardForm);
app.post('/rewards/edit/:id', upload.single('image'), isabelControl.editReward);
// User reward routes
app.get('/user/rewards', isabelControl.userRewards);
app.get('/user/rewards/read/:id', isabelControl.readReward);
app.get('/reward/:id', isabelControl.viewSingleReward);
app.post('/claimReward/:id', isabelControl.claimReward);

// Niki's user and admin leaderboard routes
app.get('/user/dashboard', checkAuthentication, checkUser, nikiController.getUserDashboard);
app.get('/user/leaderboard', checkAuthentication, checkUser, nikiController.getUserLeaderboard);
app.get('/admin/leaderboard', checkAuthentication, checkAdmin, nikiController.getAdminLeaderboard);


// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}/`));
