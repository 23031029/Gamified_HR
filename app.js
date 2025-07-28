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

cron.schedule('0 0 * * *', () => {
  update();
});

cron.schedule('* * * * *', () => {
  console.log('Running scheduled status update...');
  update();
});


// Controllers
const general= require('./controllers/generalController');
const feedback= require('./controllers/feedbackController')
const reward = require('./controllers/rewardController');
const chatInvite= require('./controllers/chat&inviteController');
const program= require('./controllers/programController');

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
app.get('/', general.getSignIn);
app.post('/sign-in', validateLogin, general.login);
app.get('/admin/register', checkAuthentication, checkAdmin, general.getRegister);
app.post('/register', checkAuthentication, checkAdmin, upload.single('profile'), validateReg, general.register);
app.get('/admin/dashboard', checkAuthentication, checkAdmin, general.getAdmin);
app.get('/logout', checkAuthentication, general.logout);
app.post('/status/:staffID', checkAuthentication, checkAdmin, general.updateStatus);
app.get('/user/profile', checkAuthentication, general.getEditDetail);
app.get('/user/change-password', checkAuthentication, general.getChangePassword);
app.post('/user/change-password', checkAuthentication, validatePasswordChange, general.postChangePassword);
app.post('/user/edit-particulars', general.editParticulars)
app.get('/editStaff/:staffID', checkAuthentication, checkAdmin, general.getEditStaff);
app.post('/editStaff/:staffID', checkAuthentication, checkAdmin, upload.single('profile'), general.postEditStaff);
app.get('/qr/:timeslotID', program.generateQRCode);
app.get('/user/scan', program.getScanQR);
app.get('/user/attend', program.markAttendance);


// Isabel
app.get('/admin/rewards', checkAuthentication, checkAdmin, reward.viewRewards);
app.get('/admin/rewards/read/:id', checkAuthentication, checkAdmin, reward.readReward);
app.get('/admin/rewards/add', checkAuthentication, checkAdmin, reward.addRewardForm);
app.post('/rewards/add', checkAuthentication, checkAdmin, upload.single('image'), reward.addReward);
app.get('/rewards/edit/:id', checkAuthentication, checkAdmin, reward.editRewardForm);
app.post('/rewards/edit/:id', checkAuthentication, checkAdmin, upload.single('image'), reward.updateReward);
app.get('/user/rewards', checkAuthentication, checkUser, reward.userRewards);
app.get('/rewards/read/:id', checkAuthentication, checkUser, reward.readReward);
app.get('/reward/:id', checkAuthentication, checkUser, reward.viewSingleReward);
app.post('/claimReward/:id', checkAuthentication, checkUser, reward.claimReward);
app.get('/user/redeemHist', checkAuthentication, checkUser, reward.redeemHistory);

// Niki's
app.get('/user/dashboard', checkAuthentication, checkUser, general.getUserDashboard);
app.get('/user/leaderboard', checkAuthentication, checkUser, general.getUserLeaderboard);
app.get('/admin/leaderboard', checkAuthentication, checkAdmin, general.getAdminLeaderboard)
app.post('/user/submit-feedback', checkAuthentication, checkUser, feedback.submitFeedback);
app.get('/admin/program/:programID/feedback', checkAuthentication, checkAdmin, feedback.viewProgramFeedback);
app.get('/admin/export-dashboard', checkAuthentication, checkAdmin, general.exportDashboard);
app.get('/admin/export-dashboard-excel', checkAuthentication, checkAdmin, general.exportDashboardExcel);
app.get('/chat', checkAuthentication, chatInvite.getChatPage);
app.get('/chat/:to', checkAuthentication, chatInvite.getMessages);
app.post('/chat/send', checkAuthentication, chatInvite.sendMessage);
app.get('/chat/unread-counts', checkAuthentication, chatInvite.getUnreadCounts);
app.post('/invite', checkAuthentication, chatInvite.sendProgramInvite);
app.get('/user/invites', checkAuthentication, checkUser, chatInvite.viewInvites);

// Alysha's program routes
app.get('/admin/programs', checkAuthentication, checkAdmin, program.getProgramsAdmin);
app.get('/user/programs', checkAuthentication, checkUser, program.getProgramsUser);
app.get('/programs/add', checkAuthentication, checkAdmin, program.getAddProgram);
app.post('/programs/add', checkAuthentication, checkAdmin, program.postAddProgram);
app.get('/programs/edit/:id', checkAuthentication, checkAdmin, program.getEditProgram);
app.post('/programs/edit/:id', checkAuthentication, checkAdmin, program.postEditProgram);
app.post('/user/programs',checkAuthentication, program.joinProgram);
app.post('/cancel/:participantID', checkAuthentication, program.cancelProgram);
app.post('/programs/toggle/:id', program.toggleProgramStatus);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}/`));
