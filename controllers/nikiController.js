const db = require('../db');

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

  const ongoingProgramsQuery = `
    SELECT sp.*, p.Start_Date, p.End_Date, p.Title, p.Type
    FROM staff_program sp 
    JOIN Program p ON sp.programID = p.ProgramID 
    WHERE sp.staffID = ? AND sp.Status != 'Completed'
  `;

  const redeemedRewardsQuery = `
    SELECT r.name, r.description, re.Redeem_Date, r.points 
    FROM Redeem re 
    JOIN Reward r ON re.RewardID = r.RewardID 
    WHERE re.staffID = ?
    ORDER BY re.Redeem_Date DESC
  `;

  const totalEarnedQuery = `SELECT SUM(points_earned) AS total_earned FROM staff_program WHERE staffID = ?`;
  const totalSpentQuery = `
    SELECT SUM(r.points) AS total_spent 
    FROM Redeem re 
    JOIN Reward r ON re.RewardID = r.RewardID 
    WHERE re.staffID = ?
  `;

  db.query(userInfoQuery, [staffID], (err, userResults) => {
    if (err) return res.status(500).send("Error fetching user info");

    const user = userResults[0];

    db.query(ongoingProgramsQuery, [staffID], (err, programResults) => {
      if (err) return res.status(500).send("Error fetching programs");

      db.query(redeemedRewardsQuery, [staffID], (err, rewardResults) => {
        if (err) return res.status(500).send("Error fetching rewards");

        db.query(totalEarnedQuery, [staffID], (err, earnedResult) => {
          if (err) return res.status(500).send("Error fetching points earned");

          db.query(totalSpentQuery, [staffID], (err, spentResult) => {
            if (err) return res.status(500).send("Error fetching points spent");

            res.render('user/dashboard', {
              user,
              programs: programResults,
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
};

// =========================
// USER LEADERBOARD
// =========================
exports.getUserLeaderboard = (req, res) => {
  const filter = req.query.filter || 'all';
  const currentDept = req.session.staff.department;

  let sql = `
    SELECT s.staffID, 
           CONCAT(s.first_name, ' ', s.last_name) AS name,
           s.total_point, 
           s.profile_image, 
           d.name AS department_name
    FROM Staff s
    JOIN Department d ON s.department = d.departmentID
    WHERE s.role = 'user'
  `;

  const params = [];

  if (filter === 'department') {
    sql += ` AND s.department = ?`;
    params.push(currentDept);
  }

  sql += ` ORDER BY s.total_point DESC`;

  db.query(sql, params, (err, leaderboardResults) => {
    if (err) return res.status(500).send("Error fetching leaderboard");

    const historySQL = `
      SELECT lh.*, 
             CONCAT(s.first_name, ' ', s.last_name) AS name,
             d.name AS department_name
      FROM leaderboard_history lh
      JOIN Staff s ON lh.staffID = s.staffID
      JOIN Department d ON s.department = d.departmentID
      ORDER BY lh.year DESC, lh.half DESC, lh.rank_position ASC
    `;

    db.query(historySQL, (err, historyResults) => {
      if (err) return res.status(500).send("Error fetching leaderboard history");

      res.render('user/leaderboard', {
        leaderboard: leaderboardResults,
        filter,
        history: historyResults,
        currentPath: req.path
      });
    });
  });
};

// =========================
// ADMIN LEADERBOARD
// =========================
exports.getAdminLeaderboard = (req, res) => {
  const filter = req.query.filter || 'all';
  const currentDept = req.session.staff.department;

  let sql = `
    SELECT s.staffID, 
           CONCAT(s.first_name, ' ', s.last_name) AS name,
           s.total_point, 
           s.profile_image, 
           d.name AS department_name
    FROM Staff s
    JOIN Department d ON s.department = d.departmentID
    WHERE s.role = 'user'
  `;

  const params = [];

  if (filter === 'department') {
    sql += ` AND s.department = ?`;
    params.push(currentDept);
  }

  sql += ` ORDER BY s.total_point DESC`;

  db.query(sql, params, (err, leaderboardResults) => {
    if (err) return res.status(500).send("Error fetching leaderboard");

    const historySQL = `
      SELECT lh.*, 
             CONCAT(s.first_name, ' ', s.last_name) AS name,
             d.name AS department_name
      FROM leaderboard_history lh
      JOIN Staff s ON lh.staffID = s.staffID
      JOIN Department d ON s.department = d.departmentID
      ORDER BY lh.year DESC, lh.half DESC, lh.rank_position ASC
    `;

    db.query(historySQL, (err, historyResults) => {
      if (err) return res.status(500).send("Error fetching leaderboard history");

      res.render('admin/leaderboard', {
        leaderboard: leaderboardResults,
        filter,
        history: historyResults,
        currentPath: req.path
      });
    });
  });
};

// =========================
// ADDITIONAL HELPER FUNCTIONS
// =========================

// Get all programs with additional details
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

// Get program feedback with staff details
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
    
    res.json({
      success: true,
      feedback: results
    });
  });
};

// Get staff participation history
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
    
    res.json({
      success: true,
      participation: results
    });
  });
};

// Get reward redemption history
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
    
    res.json({
      success: true,
      redemptions: results
    });
  });
};