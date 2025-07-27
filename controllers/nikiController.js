const db = require('../db');
const update = require('../realtimeUpdates');

// =========================
// USER DASHBOARD
// =========================
const getUserDashboard = (req, res) => {
  const staffID = req.session.staff?.staffID;
  if (!staffID) {
    return res.redirect('/login'); // or some auth fallback
  }

  const pointsEarned = req.query.pointsEarned || null;

  const userInfoQuery = `
    SELECT s.*, d.name AS department_name,
           CONCAT(s.first_name, ' ', s.last_name) AS name
    FROM Staff s 
    JOIN Department d ON s.department = d.departmentID 
    WHERE s.staffID = ?
  `;

  const registeredProgramsQuery = `
    SELECT sp.*, p.Title, pt.name AS Type, t.Date, t.Start_Time, t.Duration, 
           ADDTIME(t.Start_Time, SEC_TO_TIME(t.Duration * 60)) AS End_Time, 
           p.points_reward, sp.Status
    FROM staff_program sp
    JOIN Program p ON sp.programID = p.ProgramID
    JOIN Program_type pt ON p.TypeID = pt.typeID
    JOIN Timeslot t ON sp.timeslotID = t.timeslotID
    WHERE sp.staffID = ? AND sp.Status = 'Registered'
  `;

  const upcomingProgramsQuery = `
    SELECT sp.*, p.Title, pt.name AS Type, t.Date, t.Start_Time, t.Duration, 
           ADDTIME(t.Start_Time, SEC_TO_TIME(t.Duration * 60)) AS End_Time, 
           p.points_reward, sp.Status
    FROM staff_program sp
    JOIN Program p ON sp.programID = p.ProgramID
    JOIN Program_type pt ON p.TypeID = pt.typeID
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

  const totalSpentQuery = `
    SELECT SUM(r.points) AS total_spent 
    FROM Redeem re 
    JOIN Reward r ON re.RewardID = r.RewardID 
    WHERE re.staffID = ?
  `;

  // --- NEW QUERY FOR ALL AVAILABLE REWARDS ---
  const allRewardsQuery = `
    SELECT RewardID, name, description, points
    FROM Reward
    ORDER BY points ASC; -- Order by points might be useful for suggestions
  `;
  // --- END NEW QUERY ---

  db.query(userInfoQuery, [staffID], (err, userResults) => {
    if (err) {
      console.error('Error fetching user info:', err);
      return res.status(500).send("Error fetching user info");
    }
    if (userResults.length === 0) {
      return res.status(404).send("User not found");
    }
    const user = userResults[0];

    Promise.all([
      new Promise((resolve, reject) => {
        db.query(upcomingProgramsQuery, [staffID], (e, results) => e ? reject(e) : resolve(results));
      }),
      new Promise((resolve, reject) => {
        db.query(registeredProgramsQuery, [staffID], (e, results) => e ? reject(e) : resolve(results));
      }),
      new Promise((resolve, reject) => {
        db.query(redeemedRewardsQuery, [staffID], (e, results) => e ? reject(e) : resolve(results));
      }),
      new Promise((resolve, reject) => {
        db.query(totalSpentQuery, [staffID], (e, results) => e ? reject(e) : resolve(results));
      }),
      // --- ADD NEW PROMISE FOR ALL AVAILABLE REWARDS ---
      new Promise((resolve, reject) => {
        db.query(allRewardsQuery, [], (e, results) => e ? reject(e) : resolve(results));
      })
      // --- END NEW PROMISE ---
    ])
      .then(([upcomingPrograms, ongoingPrograms, redeemedRewards, spentResult, allAvailableRewards]) => { // Renamed 'rewards' to 'redeemedRewards' for clarity
        const spent = Number(spentResult[0]?.total_spent) || 0;
        const balance = Number(user.total_point) || 0;
        const earned = balance + spent;

        res.render('user/dashboard', {
          user,
          upcomingPrograms,
          ongoingPrograms,
          redeemedRewards,
          rewards: allAvailableRewards,
          points: {
            earned,
            spent,
            balance
          },
          pointsEarned,
          currentPath: req.path,
          currentTime: new Date()
        });
      })
      .catch(err => {
        console.error('Error fetching dashboard data:', err);
        res.status(500).send("Error fetching dashboard data");
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
    if (err) return res.status(500).send('Error loading leaderboard');

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
    if (err) return res.status(500).send('Error loading leaderboard');

    res.render('admin/leaderboard', {
      leaderboard: results,
      staffID,
      filter,
      currentPath: req.path
    });
  });
};


exports.viewProgramFeedback = (req, res) => {
  const { programID } = req.params;
  const { sort = 'Submitted_Date', order = 'DESC', filter } = req.query;

  const allowedSorts = ['Rating', 'Submitted_Date'];
  const allowedOrders = ['ASC', 'DESC'];

  const sortColumn = allowedSorts.includes(sort) ? sort : 'Submitted_Date';
  const sortOrder = allowedOrders.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';

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

exports.submitFeedback = (req, res) => {
  const staffID = req.session.staff?.staffID;
  const { programID, rating, tags, comment, bonusPoints } = req.body;

  if (!staffID || !programID || !rating) {
    return res.status(400).json({ success: false, message: "Missing fields" });
  }

  const insertQuery = `
    INSERT INTO Program_Feedback (staffID, ProgramID, Rating, Comments, Submitted_Date)
    VALUES (?, ?, ?, ?, CURDATE())
  `;

  db.query(insertQuery, [staffID, programID, rating, comment || ''], (err, result) => {
    if (err) {
      console.error("Feedback Insert Error:", err);
      return res.status(500).json({ success: false });
    }

    const updateStatusQuery = `
      UPDATE staff_program SET Status = 'Completed', feedbackSubmitted = 1 
      WHERE staffID = ? AND programID = ?
    `;

    db.query(updateStatusQuery, [staffID, programID], (err2) => {
      if (err2) {
        console.error("Update Status Error:", err2);
        return res.status(500).json({ success: false });
      }

      const updatePointsQuery = `
        UPDATE Staff SET total_point = total_point + ? WHERE staffID = ?
      `;

      db.query(updatePointsQuery, [bonusPoints || 0, staffID], (err3) => {
        if (err3) {
          console.error("Update Points Error:", err3);
          return res.status(500).json({ success: false });
        }

        return res.json({ success: true });
      });
    });
  });
};

// =========================
// CHATTING FUNCTION
// =========================

exports.sendInvite = (req, res) => {
  const senderID = req.session.staff?.staffID;
  const { receiverID, programID, message } = req.body;

  if (!senderID || !receiverID || !programID || !message) {
    req.flash('errorP', 'Missing invite fields');
    return res.redirect('/user/programs');
  }

  const sql = `
    INSERT INTO Invitations (senderID, receiverID, programID, message)
    VALUES (?, ?, ?, ?)
  `;

  db.query(sql, [senderID, receiverID, programID, message], (err) => {
    if (err) {
      console.error("Invite Insert Error:", err);
      req.flash('errorP', 'Could not send invite');
      return res.redirect('/user/programs');
    }

    req.flash('messageP', 'Invite sent successfully!');
    res.redirect('/user/programs');
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

exports.getUserDashboard = getUserDashboard;