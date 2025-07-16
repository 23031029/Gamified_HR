const db = require('../db');
const update = require('../realtimeUpdates');

// =========================
// USER DASHBOARD
// =========================
exports.getUserDashboard = (req, res) => {
  const staffID = req.session.staff.staffID;

  const userInfoQuery = `
    SELECT s.*, d.name AS department_name,
           CONCAT(s.first_name, ' ', s.last_name) AS name
    FROM Staff s 
    JOIN Department d ON s.department = d.departmentID 
    WHERE s.staffID = ?
  `;

  const registeredProgramsQuery = `
    SELECT sp.*, p.Title, p.Type, t.Date, t.Start_Time, t.Duration, 
           ADDTIME(t.Start_Time, SEC_TO_TIME(t.Duration * 60)) AS End_Time, 
           p.points_reward, sp.Status
    FROM staff_program sp
    JOIN Program p ON sp.programID = p.ProgramID
    JOIN Timeslot t ON sp.timeslotID = t.timeslotID
    WHERE sp.staffID = ? AND sp.Status = 'Registered'
  `;

  const upcomingProgramsQuery = `
    SELECT sp.*, p.Title, p.Type, t.Date, t.Start_Time, t.Duration, 
           ADDTIME(t.Start_Time, SEC_TO_TIME(t.Duration * 60)) AS End_Time, 
           p.points_reward, sp.Status
    FROM staff_program sp
    JOIN Program p ON sp.programID = p.ProgramID
    JOIN Timeslot t ON sp.timeslotID = t.timeslotID
    WHERE sp.staffID = ? AND sp.Status = "Upcoming"
    ORDER BY t.Date ASC, t.Start_Time ASC
  `;

  const redeemedRewardsQuery = `
    SELECT r.name, r.description, re.Redeem_Date, r.points 
    FROM Redeem re 
    JOIN Reward r ON re.RewardID = r.RewardID 
    WHERE re.staffID = ?
    ORDER BY re.Redeem_Date DESC
  `;

  const totalEarnedQuery = `
    SELECT SUM(p.points_reward) AS total_earned
    FROM staff_program sp
    JOIN Program p ON sp.programID = p.ProgramID
    WHERE sp.staffID = ? AND sp.Status = 'Completed'
  `;

  const totalSpentQuery = `
    SELECT SUM(r.points) AS total_spent 
    FROM Redeem re 
    JOIN Reward r ON re.RewardID = r.RewardID 
    WHERE re.staffID = ?
  `;

  update();

  db.query(userInfoQuery, [staffID], (err, userResults) => {
    if (err) return res.status(500).send("Error fetching user info");
    const user = userResults[0];

    db.query(upcomingProgramsQuery, [staffID], (err, upcomingResults) => {
      if (err) return res.status(500).send("Error fetching upcoming programs");

      db.query(registeredProgramsQuery, [staffID], (err, ongoingResults) => {
        if (err) return res.status(500).send("Error fetching registered programs");

        db.query(redeemedRewardsQuery, [staffID], (err, rewardResults) => {
          if (err) return res.status(500).send("Error fetching rewards");

          db.query(totalEarnedQuery, [staffID], (err, earnedResult) => {
            if (err) return res.status(500).send("Error fetching points earned");

            db.query(totalSpentQuery, [staffID], (err, spentResult) => {
              if (err) return res.status(500).send("Error fetching points spent");

              res.render('user/dashboard', {
                user,
                upcomingPrograms: upcomingResults,
                ongoingPrograms: ongoingResults,
                rewards: rewardResults,
                points: {
                  earned: earnedResult[0]?.total_earned || 0,
                  spent: spentResult[0]?.total_spent || 0,
                  balance: user.total_point || 0
                },
                currentPath: req.path
              });
            });
          });
        });
      });
    });
  });
};

// =========================
// USER LEADERBOARD
// =========================
exports.getUserLeaderboard = (req, res) => {
  const staffID = req.session.staff.staffID;
  const filter = req.query.filter || 'all';

  let query = `
    SELECT staffID, CONCAT(first_name, ' ', last_name) AS name, profile_image, department.name AS department_name, total_point
    FROM staff
    JOIN department ON staff.department = department.departmentID
  `;
  const params = [];

  if (filter === 'department') {
    query += ' WHERE department.departmentID = (SELECT department FROM staff WHERE staffID = ?)';
    params.push(staffID);
  }

  query += ' ORDER BY total_point DESC';

  db.query(query, params, (err, results) => {
    if (err) {
      return res.status(500).send('Error loading leaderboard');
    }

    res.render('user/leaderboard', {
      leaderboard: results,
      staffID,
      filter,
      currentPath: req.path
    });
  });
};

// =========================
// ADMIN LEADERBOARD
// =========================
exports.getAdminLeaderboard = (req, res) => {
  const staffID = req.session.staff.staffID;
  const filter = req.query.filter || 'all';

  let query = `
    SELECT staffID, CONCAT(first_name, ' ', last_name) AS name, profile_image, department.name AS department_name, total_point
    FROM staff
    JOIN department ON staff.department = department.departmentID
  `;
  const params = [];

  if (filter === 'department') {
    query += ' WHERE department.departmentID = (SELECT department FROM staff WHERE staffID = ?)';
    params.push(staffID);
  }

  query += ' ORDER BY total_point DESC';

  db.query(query, params, (err, results) => {
    if (err) {
      return res.status(500).send('Error loading leaderboard');
    }

    res.render('admin/leaderboard', {
      leaderboard: results,
      staffID,
      filter,
      currentPath: req.path
    });
  });
};

// =========================
// FEEDBACK
// =========================

exports.submitFeedback = (req, res) => {
  const { programID, rating, comment, tags, bonusPoints } = req.body;
  const staffID = req.session.staff.staffID;

  console.log("==== FEEDBACK SUBMIT ATTEMPT ====");
  console.log("ProgramID:", programID);
  console.log("StaffID:", staffID);
  console.log("Rating:", rating);
  console.log("Tags:", tags);
  console.log("Comment:", comment);
  console.log("BonusPoints:", bonusPoints);

  const sql = `
    INSERT INTO Program_Feedback (staffID, ProgramID, Rating, Comments, Tags, BonusPoints, Submitted_Date)
    VALUES (?, ?, ?, ?, ?, ?, CURDATE())
  `;

  db.query(sql, [staffID, programID, rating, comment, tags, bonusPoints], (err) => {
    if (err) {
      console.error("⚠️ INSERT ERROR:", err);
      return res.status(500).json({ success: false, error: err.message });
    }

    const updatePointsSql = `UPDATE staff SET total_point = total_point + ? WHERE staffID = ?`;
    db.query(updatePointsSql, [bonusPoints, staffID], (err2) => {
      if (err2) {
        console.error("⚠️ POINTS UPDATE ERROR:", err2);
        return res.status(500).json({ success: false, error: err2.message });
      }

      console.log("✅ Feedback and bonus points submitted successfully.");
      return res.json({ success: true });
    });
  });
};

exports.viewProgramFeedback = (req, res) => {
  const { programID } = req.params;
  const { sort = 'Submitted_Date', order = 'DESC', filter } = req.query;

  // Only allow safe column names
  const allowedSorts = ['Rating', 'Submitted_Date'];
  const allowedOrders = ['ASC', 'DESC'];

  const sortParam = typeof sort === 'string' ? sort : '';
  const orderParam = typeof order === 'string' ? order.toUpperCase() : '';

  const sortColumn = allowedSorts.includes(sortParam) ? sortParam : 'Submitted_Date';
  const sortOrder = allowedOrders.includes(orderParam) ? orderParam : 'DESC';

  let sql = `
    SELECT pf.*, 
           CONCAT(s.first_name, ' ', s.last_name) AS staff_name,
           s.profile_image,
           p.Title AS program_title
    FROM Program_Feedback pf
    JOIN Staff s ON pf.staffID = s.staffID
    JOIN Program p ON pf.ProgramID = p.ProgramID
    WHERE pf.ProgramID = ?
  `;

  const params = [programID];

  if (filter) {
    sql += ' AND FLOOR(pf.Rating) = ?';
    params.push(parseInt(filter));
  }

  sql += ` ORDER BY pf.${sortColumn} ${sortOrder}`;

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error(err);
      req.flash('errorP', 'Error loading feedback');
      return res.redirect('/admin/programs');
    }

    const programTitle = results.length > 0 ? results[0].program_title : "This Program";

    res.render('admin/programFeedback', {
      feedbacks: results,
      programTitle,
      sort,
      order,
      filter,
      currentPath: req.path
    });
  });
};

// =========================
// HELPER FUNCTIONS
// =========================

exports.getAllPrograms = (req, res) => {
  const sql = `
    SELECT p.*, 
           CONCAT(s.first_name, ' ', s.last_name) AS created_by_name,
           d.name AS creator_department
    FROM Program p
    JOIN Staff s ON p.Created_By = s.staffID
    JOIN Department d ON s.department = d.departmentID
    ORDER BY p.Start_Date DESC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).send("Error fetching programs");
    res.render('programs/list', {
      programs: results,
      currentPath: req.path
    });
  });
};

exports.getProgramFeedback = (req, res) => {
  const programID = req.params.programID;

  const sql = `
    SELECT pf.*, 
           CONCAT(s.first_name, ' ', s.last_name) AS staff_name,
           p.Title AS program_title
    FROM Program_Feedback pf
    JOIN Staff s ON pf.staffID = s.staffID
    JOIN Program p ON pf.ProgramID = p.ProgramID
    WHERE pf.ProgramID = ?
    ORDER BY pf.Submitted_Date DESC
  `;

  db.query(sql, [programID], (err, results) => {
    if (err) return res.status(500).send("Error fetching feedback");
    res.json({ success: true, feedback: results });
  });
};

exports.getStaffParticipation = (req, res) => {
  const staffID = req.params.staffID || req.session.staff.staffID;

  const sql = `
    SELECT sp.*, p.Title, p.Type, p.Start_Date, p.End_Date
    FROM staff_program sp
    JOIN Program p ON sp.programID = p.ProgramID
    WHERE sp.staffID = ?
    ORDER BY sp.completed_date DESC
  `;

  db.query(sql, [staffID], (err, results) => {
    if (err) return res.status(500).send("Error fetching participation history");
    res.json({ success: true, participation: results });
  });
};

exports.getRedemptionHistory = (req, res) => {
  const staffID = req.params.staffID || req.session.staff.staffID;

  const sql = `
    SELECT r.*, 
           re.Redeem_Date,
           re.RedemptionID
    FROM Redeem re
    JOIN Reward r ON re.RewardID = r.RewardID
    WHERE re.staffID = ?
    ORDER BY re.Redeem_Date DESC
  `;

  db.query(sql, [staffID], (err, results) => {
    if (err) return res.status(500).send("Error fetching redemption history");
    res.json({ success: true, redemptions: results });
  });
};
