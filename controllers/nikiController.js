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
    SELECT sp.*, p.Start_Date, p.End_Date, p.Title, p.Type, sp.Status
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

  const totalEarnedQuery = `
    SELECT SUM(points_earned) AS total_earned 
    FROM staff_program 
    WHERE staffID = ?
  `;

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
  const staffID = req.session.staff.staffID;

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
        staffID,
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
    WHERE s.status = 'Active'
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
        staffID: req.session.staff.staffID,
        currentPath: req.path
      });
    });
  });
};

// =========================
// ADD / EDIT / DELETE LEADERBOARD HISTORY
// =========================

exports.getAddLeaderboardEntry = (req, res) => {
  db.query("SELECT staffID, CONCAT(first_name, ' ', last_name) AS name FROM Staff WHERE role = 'user' AND status = 'Active'", (err, staff) => {
    if (err) return res.status(500).send("Error fetching staff");
    res.render('admin/leaderboard_add', { staff });
  });
};

exports.postAddLeaderboardEntry = (req, res) => {
  const { year, half, rank_position, staffID, reward } = req.body;
  const currentYear = new Date().getFullYear();

  if (parseInt(year) < currentYear) {
    return res.status(400).send("Only current or future years are allowed.");
  }

  const checkSQL = `
    SELECT * FROM leaderboard_history 
    WHERE year = ? AND half = ? AND rank_position = ?
  `;

  db.query(checkSQL, [year, half, rank_position], (err, existing) => {
    if (err) return res.status(500).send("Error checking for duplicate");
    if (existing.length > 0) {
      return res.status(400).send("Rank already assigned for that period.");
    }

    const insertSQL = `
      INSERT INTO leaderboard_history (year, half, rank_position, staffID, reward)
      VALUES (?, ?, ?, ?, ?)
    `;

    db.query(insertSQL, [year, half, rank_position, staffID, reward], (err) => {
      if (err) return res.status(500).send("Error inserting entry");
      res.redirect('/admin/leaderboard');
    });
  });
};

exports.getEditLeaderboardEntry = (req, res) => {
  const id = req.params.id;

  const entrySQL = `SELECT * FROM leaderboard_history WHERE Leaderboard_ID = ?`;
  const staffSQL = `SELECT staffID, CONCAT(first_name, ' ', last_name) AS name FROM Staff WHERE role = 'user' AND status = 'Active'`;

  db.query(entrySQL, [id], (err, entryResult) => {
    if (err || entryResult.length === 0) return res.status(404).send("Entry not found");

    db.query(staffSQL, (err, staff) => {
      if (err) return res.status(500).send("Error fetching staff");
      res.render('admin/leaderboard_edit', { entry: entryResult[0], staff });
    });
  });
};

exports.postEditLeaderboardEntry = (req, res) => {
  const id = req.params.id;
  const { year, half, rank_position, staffID, reward } = req.body;
  const currentYear = new Date().getFullYear();

  if (parseInt(year) < currentYear) {
    return res.status(400).send("Only current or future years are allowed.");
  }

  const checkSQL = `
    SELECT * FROM leaderboard_history 
    WHERE year = ? AND half = ? AND rank_position = ? AND Leaderboard_ID != ?
  `;

  db.query(checkSQL, [year, half, rank_position, id], (err, existing) => {
    if (err) return res.status(500).send("Error checking for duplicates");
    if (existing.length > 0) {
      return res.status(400).send("That rank is already assigned for this period.");
    }

    const updateSQL = `
      UPDATE leaderboard_history 
      SET year = ?, half = ?, rank_position = ?, staffID = ?, reward = ?
      WHERE Leaderboard_ID = ?
    `;

    db.query(updateSQL, [year, half, rank_position, staffID, reward, id], (err) => {
      if (err) return res.status(500).send("Error updating entry");
      res.redirect('/admin/leaderboard');
    });
  });
};

exports.deleteLeaderboardEntry = (req, res) => {
  const id = req.params.id;
  db.query("DELETE FROM leaderboard_history WHERE Leaderboard_ID = ?", [id], (err) => {
    if (err) return res.status(500).send("Error deleting entry");
    res.redirect('/admin/leaderboard');
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
