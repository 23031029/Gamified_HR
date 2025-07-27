const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const flash = require('connect-flash');
const session = require('express-session');
const app = express();
const path = require('path');
const cron = require('node-cron');

const db = require('./db');
const update = require('./realtimeUpdates');

// Add this after your other requires and before app.listen:
cron.schedule('0 0 * * *', () => {
  update();
  console.log('Auto-updated program statuses');
});

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
        cb(null, 'public/images');
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

app.use('/images', express.static('public/images'));

const upload = multer({ storage: storage });

app.use(express.json());

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
app.post('/user/edit-particulars', serjiaControl.editParticulars)
app.get('/editStaff/:staffID', checkAuthentication, checkAdmin, serjiaControl.getEditStaff);
app.post('/editStaff/:staffID', checkAuthentication, checkAdmin, upload.single('profile'), serjiaControl.postEditStaff);
app.get('/admin/generate', serjiaControl.getGenerateQR);
app.get('/user/scan', serjiaControl.getScanQR);
app.get('/user/attend', serjiaControl.markAttendance);

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
app.get('/user/redeemHist', checkAuthentication, checkUser, isabelControl.redeemHistory);

// Niki's user and admin leaderboard routes
app.get('/user/dashboard', checkAuthentication, checkUser, nikiController.getUserDashboard);
app.get('/user/leaderboard', checkAuthentication, checkUser, nikiController.getUserLeaderboard);
app.get('/admin/leaderboard', checkAuthentication, checkAdmin, nikiController.getAdminLeaderboard)

// Niki's feedback routes
app.post('/submit-feedback', nikiController.submitFeedback);
app.get('/admin/program/:programID/feedback', checkAuthentication, checkAdmin, nikiController.viewProgramFeedback);
app.get('/admin/export-feedback', checkAuthentication, checkAdmin, nikiController.exportFeedbackData);
app.get('/admin/export-dashboard', checkAuthentication, checkAdmin, nikiController.exportAdminDashboard);

// Niki's chat routes
app.get('/chat', checkAuthentication, nikiController.getChatPage);
app.get('/chat/:to', checkAuthentication, nikiController.getMessages);
app.post('/chat/send', checkAuthentication, nikiController.sendMessage);
app.get('/chat/unread-counts', checkAuthentication, nikiController.getUnreadCounts);

// Niki's invite routes
app.post('/invite', checkAuthentication, nikiController.sendProgramInvite);
app.get('/user/invites', checkAuthentication, checkUser, nikiController.viewInvites);

// Alysha's program routes
app.get('/admin/programs', checkAuthentication, checkAdmin, alyshaControl.getProgramsAdmin);
app.get('/user/programs', checkAuthentication, checkUser, alyshaControl.getProgramsUser);
app.post('/programs/delete/:id', checkAuthentication, checkAdmin, alyshaControl.deleteProgram);

app.get('/programs/add', checkAuthentication, checkAdmin, alyshaControl.getAddProgram);
app.post('/programs/add', checkAuthentication, checkAdmin, upload.single('qr_code'), alyshaControl.postAddProgram);

app.get('/programs/edit/:id', checkAuthentication, checkAdmin, alyshaControl.getEditProgram);
app.post('/programs/edit/:id', checkAuthentication, checkAdmin, alyshaControl.postEditProgram);
app.post('/user/programs',checkAuthentication, alyshaControl.joinProgram);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}/`));
