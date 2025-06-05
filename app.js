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
const nikiController = require('./controllers/nikiController'); // includes both user & admin logic

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
app.get('/logout', serjiaControl.logout);

// User routes
app.get('/user/dashboard', checkAuthentication, checkUser, nikiController.getUserDashboard);
app.get('/user/leaderboard', checkAuthentication, checkUser, nikiController.getUserLeaderboard);

// Admin routes (also in nikiController)
app.get('/admin/dashboard', checkAuthentication, checkAdmin, nikiController.getAdminDashboard);
app.get('/admin/leaderboard', checkAuthentication, checkAdmin, nikiController.getAdminLeaderboard);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}/`));
