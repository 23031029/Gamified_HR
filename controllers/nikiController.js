const db = require('../db');
const update = require('../realtimeUpdates');
const ExcelJS = require("exceljs");

// =========================
// USER DASHBOARD
// =========================
const getUserDashboard = (req, res) => {
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

  const totalSpentQuery = `
    SELECT SUM(r.points) AS total_spent 
    FROM Redeem re 
    JOIN Reward r ON re.RewardID = r.RewardID 
    WHERE re.staffID = ?
  `;

  const pointHistoryQuery = `
    SELECT r.name AS source, r.points * -1 AS points, re.Redeem_Date AS date, 'Spent' AS type
    FROM Redeem re
    JOIN Reward r ON re.RewardID = r.RewardID
    WHERE re.staffID = ?

    UNION

    SELECT p.Title AS source, p.points_reward AS points, t.Date AS date, 'Earned' AS type
    FROM staff_program sp
    JOIN Program p ON sp.programID = p.ProgramID
    JOIN Timeslot t ON sp.timeslotID = t.timeslotID
    WHERE sp.Status = 'Completed' AND sp.staffID = ?

    ORDER BY date DESC
  `;

  db.query(userInfoQuery, [staffID], (err, userResults) => {
    if (err) return res.status(500).send("Error fetching user info");
    const user = userResults[0];

    db.query(upcomingProgramsQuery, [staffID], (err, upcomingResults) => {
      if (err) return res.status(500).send("Error fetching upcoming programs");

      db.query(registeredProgramsQuery, [staffID], (err, ongoingResults) => {
        if (err) return res.status(500).send("Error fetching registered programs");

        db.query(redeemedRewardsQuery, [staffID], (err, rewardResults) => {
          if (err) return res.status(500).send("Error fetching rewards");

          db.query(totalSpentQuery, [staffID], (err, spentResult) => {
            if (err) return res.status(500).send("Error fetching points spent");

            db.query(pointHistoryQuery, [staffID, staffID], (err, pointHistory) => {
              if (err) return res.status(500).send("Error fetching point history");

              const spent = Number(spentResult[0]?.total_spent) || 0;
              const balance = Number(user.total_point) || 0;
              const earned = balance + spent;

              res.render('user/dashboard', {
                user,
                upcomingPrograms: upcomingResults,
                ongoingPrograms: ongoingResults,
                rewards: rewardResults,
                points: {
                  earned,
                  spent,
                  balance
                },
                pointHistory,
                currentPath: req.path
              });
            }); // ← closed pointHistoryQuery
          }); // ← closed totalSpentQuery
        }); // ← closed redeemedRewardsQuery
      }); // ← closed registeredProgramsQuery
    }); // ← closed upcomingProgramsQuery
  }); // ← closed userInfoQuery
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

  db.query(query, params, (err, leaderboard) => {
    if (err) return res.status(500).send('Error loading leaderboard');

    // Only fetch history for current user
    const historyQuery = `
      SELECT r.name AS source, r.points * -1 AS points, re.Redeem_Date AS date, 'Redeem' AS type
      FROM Redeem re
      JOIN Reward r ON re.RewardID = r.RewardID
      WHERE re.staffID = ?
      
      UNION

      SELECT p.Title AS source, p.points_reward AS points, t.Date AS date, 'Program' AS type
      FROM staff_program sp
      JOIN Program p ON sp.programID = p.ProgramID
      JOIN Timeslot t ON sp.timeslotID = t.timeslotID
      WHERE sp.Status = 'Completed' AND sp.staffID = ?

      ORDER BY date DESC
    `;

    db.query(historyQuery, [staffID, staffID], (err2, history) => {
      if (err2) return res.status(500).send('Error loading point history');

      // Attach history only to the current user
      leaderboard.forEach(user => {
        if (user.staffID === staffID) {
          user.history = history;
        }
      });

      res.render('user/leaderboard', {
        leaderboard,
        staffID,
        filter,
        currentPath: req.path
      });
    });
  });
};

// =========================
// ADMIN LEADERBOARD
// =========================
exports.getAdminLeaderboard = (req, res) => {
  const staffID = req.session.staff.staffID;
  const filter = req.query.filter || 'all';

  let leaderboardQuery = `
    SELECT staffID, CONCAT(first_name, ' ', last_name) AS name, profile_image, department.name AS department_name, total_point
    FROM staff
    JOIN department ON staff.department = department.departmentID
  `;
  const params = [];

  if (filter === 'department') {
    leaderboardQuery += ' WHERE department.departmentID = (SELECT department FROM staff WHERE staffID = ?)';
    params.push(staffID);
  }

  leaderboardQuery += ' ORDER BY total_point DESC';

  db.query(leaderboardQuery, params, async (err, leaderboard) => {
    if (err) return res.status(500).send('Error loading leaderboard');

    const getPointHistory = (staffID) => {
      return new Promise((resolve, reject) => {
        const sql = `
          SELECT 
            sp.staffID,
            t.Date AS date,
            p.Title AS source,
            p.points_reward AS points,
            'Program' AS type
          FROM staff_program sp
          JOIN Timeslot t ON sp.timeslotID = t.timeslotID
          JOIN Program p ON sp.programID = p.ProgramID
          WHERE sp.staffID = ? AND sp.Status = 'Completed'

          UNION

          SELECT 
            r.staffID,
            re.Redeem_Date AS date,
            rw.name AS source,
            -rw.points AS points,
            'Redeem' AS type
          FROM Redeem re
          JOIN Reward rw ON re.RewardID = rw.RewardID
          JOIN Staff r ON re.staffID = r.staffID
          WHERE re.staffID = ?
          
          ORDER BY date DESC
        `;
        db.query(sql, [staffID, staffID], (err2, result) => {
          if (err2) return reject(err2);
          resolve(result);
        });
      });
    };

    // Map each leaderboard user to their point history
    const leaderboardWithHistory = await Promise.all(
      leaderboard.map(async (user) => {
        const history = await getPointHistory(user.staffID);
        return { ...user, history };
      })
    );

    res.render('admin/leaderboard', {
      leaderboard: leaderboardWithHistory,
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

exports.exportFeedbackData = (req, res) => {
  const { programID } = req.query; // for optional filtering

  let query = `
    SELECT pf.FeedbackID, 
           CONCAT(s.first_name, ' ', s.last_name) AS StaffName,
           p.Title AS ProgramTitle,
           pf.Rating, 
           pf.Comments, 
           pf.Submitted_Date
    FROM Program_Feedback pf
    JOIN Staff s ON pf.staffID = s.staffID
    JOIN Program p ON pf.ProgramID = p.ProgramID
  `;
  const params = [];

  if (programID) {
    query += ` WHERE pf.ProgramID = ?`;
    params.push(programID);
  }

  query += ` ORDER BY pf.Submitted_Date DESC`;

  db.query(query, async (err, results) => {
    if (err) {
      console.error("Error exporting feedback:", err);
      return res.status(500).send("Error generating Excel file");
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Program Feedback");

    worksheet.columns = [
      { header: "Feedback ID", key: "FeedbackID", width: 12 },
      { header: "Staff Name", key: "StaffName", width: 25 },
      { header: "Program Title", key: "ProgramTitle", width: 25 },
      { header: "Rating", key: "Rating", width: 10 },
      { header: "Comments", key: "Comments", width: 40 },
      { header: "Submitted Date", key: "Submitted_Date", width: 15 },
    ];

    worksheet.addRows(results);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${programID ? 'feedback_' + programID : 'all_feedback'}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  });
};

exports.exportAdminDashboard = async (req, res) => {
  const ExcelJS = require("exceljs");
  const workbook = new ExcelJS.Workbook();

  try {
    // 1. STAFF SHEET
    const staffSheet = workbook.addWorksheet("Staff Details");
    const staffSql = `SELECT s.staffID, CONCAT(s.first_name, ' ', s.last_name) AS Name, s.email, s.gender, s.role, d.name AS Department, s.date_join, s.status, s.total_point FROM staff s JOIN department d ON s.department = d.departmentID`;
    const [staffRows] = await db.promise().query(staffSql);
    staffSheet.columns = [
      { header: "Staff ID", key: "staffID", width: 10 },
      { header: "Name", key: "Name", width: 20 },
      { header: "Email", key: "email", width: 25 },
      { header: "Gender", key: "gender", width: 10 },
      { header: "Role", key: "role", width: 10 },
      { header: "Department", key: "Department", width: 20 },
      { header: "Date Joined", key: "date_join", width: 15 },
      { header: "Status", key: "status", width: 10 },
      { header: "Total Points", key: "total_point", width: 12 },
    ];
    staffSheet.addRows(staffRows);

    // 2. POPULAR PROGRAMS SHEET
    const programSheet = workbook.addWorksheet("Popular Programs");
    const [programRows] = await db.promise().query(`
      SELECT p.Title AS Program, ROUND(AVG(f.Rating), 2) AS AvgRating
      FROM Program p
      JOIN Program_Feedback f ON p.ProgramID = f.ProgramID
      GROUP BY p.Title
      ORDER BY AvgRating DESC
    `);
    programSheet.columns = [
      { header: "Program Title", key: "Program", width: 30 },
      { header: "Average Rating", key: "AvgRating", width: 15 },
    ];
    programSheet.addRows(programRows);

    // 3. REDEEMED REWARDS SHEET
    const rewardsSheet = workbook.addWorksheet("Redeemed Rewards");
    const [rewardRows] = await db.promise().query(`
      SELECT r.name AS Reward, COUNT(*) AS RedeemedCount
      FROM Redeem re
      JOIN Reward r ON re.RewardID = r.RewardID
      GROUP BY r.name
      ORDER BY RedeemedCount DESC
    `);
    rewardsSheet.columns = [
      { header: "Reward Name", key: "Reward", width: 30 },
      { header: "Redeemed Count", key: "RedeemedCount", width: 15 },
    ];
    rewardsSheet.addRows(rewardRows);

    // 4. ACTIVE DEPARTMENTS SHEET
    const activeDeptSheet = workbook.addWorksheet("Active Departments");
    const [activeDeptRows] = await db.promise().query(`
      SELECT d.name AS Department, COUNT(*) AS ParticipationCount
      FROM staff_program sp
      JOIN staff s ON sp.staffID = s.staffID
      JOIN department d ON s.department = d.departmentID
      JOIN timeslot t ON sp.timeslotID = t.timeslotID
      WHERE MONTH(t.Date) = MONTH(CURDATE())
        AND YEAR(t.Date) = YEAR(CURDATE())
      GROUP BY d.name
      ORDER BY ParticipationCount DESC
    `);
    activeDeptSheet.columns = [
      { header: "Department", key: "Department", width: 25 },
      { header: "Participation Count", key: "ParticipationCount", width: 20 },
    ];
    activeDeptSheet.addRows(activeDeptRows);

    // 5. PARTICIPANT TRENDS SHEET
    const trendsSheet = workbook.addWorksheet("Monthly Participation");
    const [trendRows] = await db.promise().query(`
      SELECT DATE_FORMAT(t.Date, '%Y-%m') AS Month, COUNT(*) AS Participants
      FROM staff_program sp
      JOIN timeslot t ON sp.timeslotID = t.timeslotID
      WHERE sp.Status = 'Completed'
      GROUP BY Month
      ORDER BY Month
    `);
    trendsSheet.columns = [
      { header: "Month", key: "Month", width: 15 },
      { header: "No. of Participants", key: "Participants", width: 20 },
    ];
    trendsSheet.addRows(trendRows);

    // Send the file
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=admin_dashboard_data.xlsx");
    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error("Export Error:", err);
    res.status(500).send("Error generating Excel file");
  }
};

// =========================
// CHAT FEATURE
// =========================

exports.getChatPage = (req, res) => {
  const staffID = req.session.staff.staffID;

  const staffQuery = `
    SELECT staffID, CONCAT(first_name, ' ', last_name) AS name, profile_image
    FROM Staff
    WHERE staffID != ?
  `;
  db.query(staffQuery, [staffID], (err, staffList) => {
    if (err) return res.status(500).send("Error loading staff list");

    res.render('user/chat', { staffList, currentPath: req.path });
  });
};

exports.getMessages = (req, res) => {
  const { to } = req.params;
  const from = req.session.staff.staffID;

  const query = `
    SELECT * FROM Messages
    WHERE (senderID = ? AND receiverID = ?)
       OR (senderID = ? AND receiverID = ?)
    ORDER BY sent_at ASC
  `;

  db.query(query, [from, to, to, from], (err, results) => {
    if (err) return res.status(500).json({ success: false });

    // 🟢 Mark incoming messages as read
    const markAsReadQuery = `
      UPDATE Messages
      SET is_read = 1
      WHERE senderID = ? AND receiverID = ? AND is_read = 0
    `;
    db.query(markAsReadQuery, [to, from], () => {});

    res.json(results);
  });
};

exports.sendMessage = (req, res) => {
  const { receiverID, content } = req.body;
  const senderID = req.session.staff.staffID;

  const query = `INSERT INTO Messages (senderID, receiverID, content) VALUES (?, ?, ?)`;
  db.query(query, [senderID, receiverID, content], (err) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true });
  });
};

exports.getUnreadCounts = (req, res) => {
  const currentUser = req.session.staff?.staffID;

  if (!currentUser) return res.status(401).json({ error: 'Not logged in' });

  const sql = `
    SELECT senderID, COUNT(*) as unreadCount
    FROM Messages
    WHERE receiverID = ? AND is_read = 0
    GROUP BY senderID
  `;

  db.query(sql, [currentUser], (err, results) => {
    if (err) return res.status(500).json({ error: 'DB error' });

    const counts = {};
    results.forEach(row => {
      counts[row.senderID] = row.unreadCount;
    });

    res.json(counts); // example: { S002: 3, S004: 1 }
  });
};


// =========================
// INVITE FEATURE
// =========================

exports.sendProgramInvite = (req, res) => {
  const inviterID = req.session.staff.staffID;
  const { inviteeIDs, programID } = req.body;

  let invitees = Array.isArray(inviteeIDs) ? inviteeIDs : [inviteeIDs];

  invitees = invitees.filter(id => id !== inviterID);

  if (invitees.length === 0) {
    return res.json({ success: false, message: "No valid invitees selected." });
  }

  const values = invitees.map(id => [inviterID, id, programID]);

  const query = `INSERT IGNORE INTO Program_Invite (InviterID, InviteeID, ProgramID) VALUES ?`;

  db.query(query, [values], (err, result) => {
    if (err) return res.json({ success: false, message: "Database error" });
    res.json({ success: true, invitedCount: result.affectedRows });
  });
};

exports.viewInvites = (req, res) => {
  const staffID = req.session.staff.staffID;

  const query = `
    SELECT pi.*, 
           p.Title, 
           CONCAT(s.first_name, ' ', s.last_name) AS inviter_name
    FROM Program_Invite pi
    JOIN Program p ON pi.ProgramID = p.ProgramID
    JOIN Staff s ON pi.InviterID = s.staffID
    WHERE pi.InviteeID = ?
    ORDER BY pi.created_at DESC
  `;

  db.query(query, [staffID], (err, invites) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Error loading invites");
    }

    res.render('user/invites', {
      invites,
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

exports.getUserDashboard = getUserDashboard;