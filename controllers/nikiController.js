const db = require('../db');
const update = require('../realtimeUpdates');

// =========================
// USER DASHBOARD
// =========================
const getUserDashboard = (req, res) => {
  const staffID = req.session.staff?.staffID;
  if (!staffID) {
    return res.redirect('/login'); 
  }
  const pointsEarned = req.query.pointsEarned || null;
  
  const userInfoQuery = `
    SELECT s.*, d.name AS department_name,
           CONCAT(s.first_name, ' ', s.last_name) AS name
    FROM Staff s 
    JOIN Department d ON s.department = d.departmentID 
    WHERE s.staffID = ?
  `;
  
  // Programs with Status = 'Registered' (excluding today's programs)
  const registeredProgramsQuery = `
    SELECT sp.*, p.Title, pt.name AS Type, t.Date, t.Start_Time, t.Duration, 
           ADDTIME(t.Start_Time, SEC_TO_TIME(t.Duration * 60)) AS End_Time, 
           p.points_reward, sp.Status
    FROM staff_program sp
    JOIN Program p ON sp.programID = p.ProgramID
    JOIN Program_type pt ON p.TypeID = pt.typeID
    JOIN Timeslot t ON sp.timeslotID = t.timeslotID
    WHERE sp.staffID = ? AND sp.Status = 'Registered' AND t.Date != CURDATE()
    ORDER BY t.Date ASC, t.Start_Time ASC
  `;
  
  // Today's programs (Upcoming, Ongoing, or Registered programs scheduled for today)
  const todaysProgramsQuery = `
    SELECT sp.*, p.Title, pt.name AS Type, t.Date, t.Start_Time, t.Duration, 
           ADDTIME(t.Start_Time, SEC_TO_TIME(t.Duration * 60)) AS End_Time, 
           p.points_reward, sp.Status
    FROM staff_program sp
    JOIN Program p ON sp.programID = p.ProgramID
    JOIN Program_type pt ON p.TypeID = pt.typeID
    JOIN Timeslot t ON sp.timeslotID = t.timeslotID
    WHERE sp.staffID = ? AND (
      (sp.Status = "Upcoming" OR sp.Status = "Ongoing") OR 
      (sp.Status = "Registered" AND t.Date = CURDATE())
    )
    ORDER BY 
      CASE sp.Status 
        WHEN 'Ongoing' THEN 1
        WHEN 'Upcoming' THEN 2
        WHEN 'Registered' THEN 3
        ELSE 4
      END,
      t.Date ASC, 
      t.Start_Time ASC
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

    UNION

    SELECT CONCAT('Milestone ', milestone) AS source, bonus_points AS points, awarded_at AS date, 'Bonus' AS type
    FROM Staff_Milestone
    WHERE staffID = ?
    ORDER BY date DESC
  `;
  
  db.query(userInfoQuery, [staffID], (err, userResults) => {
    if (err || userResults.length === 0) return res.status(500).send("Error fetching user info");
    const user = userResults[0];
    
    // Query Today's programs first
    db.query(todaysProgramsQuery, [staffID], (err, todaysResults) => {
      if (err) return res.status(500).send("Error fetching today's programs");
      
      // Query Registered programs (excluding today's)
      db.query(registeredProgramsQuery, [staffID], (err, registeredResults) => {
        if (err) return res.status(500).send("Error fetching registered programs");
        
        db.query(redeemedRewardsQuery, [staffID], (err, rewardResults) => {
          if (err) return res.status(500).send("Error fetching rewards");
          
          db.query(totalSpentQuery, [staffID], (err, spentResult) => {
            if (err) return res.status(500).send("Error fetching points spent");
            db.query(pointHistoryQuery, [staffID, staffID, staffID], (err, pointHistory) => {
              if (err) return res.status(500).send("Error fetching point history");
              
              const spent = Number(spentResult[0]?.total_spent) || 0;
              const balance = Number(user.total_point) || 0;
              const earned = balance + spent;
              // Milestone logic
              const milestoneThresholds = [
                { value: 500, bonus: 10 },
                { value: 1000, bonus: 20 },
                { value: 1500, bonus: 30 },
                { value: 2000, bonus: 40 },
                { value: 2500, bonus: 50 },
                { value: 3000, bonus: 60 }
              ];

              const checkMilestonesQuery = `SELECT milestone FROM Staff_Milestone WHERE staffID = ?`;
              db.query(checkMilestonesQuery, [staffID], (err, milestoneRows) => {
                if (err) return res.status(500).send("Error checking milestones");

                const alreadyAwarded = new Set(milestoneRows.map(row => row.milestone));
                const toAward = milestoneThresholds.filter(m => balance >= m.value && !alreadyAwarded.has(m.value));

                if (toAward.length === 0) return renderDashboard();

                const bonusTotal = toAward.reduce((sum, m) => sum + m.bonus, 0);
                const values = toAward.map(m => [staffID, m.value, m.bonus]);

                const insertMilestones = `INSERT INTO Staff_Milestone (staffID, milestone, bonus_points) VALUES ?`;
                const updatePoints = `UPDATE Staff SET total_point = total_point + ? WHERE staffID = ?`;

                db.query(insertMilestones, [values], (err2) => {
                  if (err2) return res.status(500).send("Error saving milestone bonus");

                  db.query(updatePoints, [bonusTotal, staffID], (err3) => {
                    if (err3) return res.status(500).send("Error updating bonus points");

                    // ✅ Redirect to show updated points & flash message
                    return res.redirect(`/user/dashboard?pointsEarned=${bonusTotal}`);
                  });
                });
              });

              res.render('user/dashboard', {
                user,
                todaysPrograms: todaysResults, // All today's programs (upcoming, ongoing, registered for today)
                registeredPrograms: registeredResults, // Only registered programs not for today
                rewards: rewardResults,
                points: {
                  earned,
                  spent,
                  balance
                },
                pointHistory,
                currentPath: req.path,
                pointsEarned,
                currentTime: new Date()
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
  console.log("=== FEEDBACK SUBMISSION DEBUG ===");
  console.log("Session:", req.session);
  console.log("Request body:", req.body);
  console.log("Content-Type:", req.headers['content-type']);
  
  const staffID = req.session.staff?.staffID;
  const { programID, rating, tags, comment } = req.body;

  console.log("Extracted data:", { staffID, programID, rating, tags, comment });

  // Validation checks
  if (!staffID) {
    console.log("ERROR: No staffID in session");
    return res.status(400).json({ success: false, message: "User not authenticated" });
  }

  if (!programID) {
    console.log("ERROR: No programID provided");
    return res.status(400).json({ success: false, message: "Program ID is required" });
  }

  if (!rating) {
    console.log("ERROR: No rating provided");
    return res.status(400).json({ success: false, message: "Rating is required" });
  }

  // Convert rating to number if it's a string
  const numericRating = typeof rating === 'string' ? parseFloat(rating) : rating;
  
  if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
    console.log("ERROR: Invalid rating:", numericRating);
    return res.status(400).json({ success: false, message: "Rating must be between 1 and 5" });
  }

  // Calculate bonus points server-side
  let bonusPoints = 5; // Base points for submitting feedback
  if (tags && Array.isArray(tags) && tags.length > 0) {
    bonusPoints += 5;
  } else if (tags && typeof tags === 'string' && tags.trim()) {
    bonusPoints += 5;
  }
  
  if (comment && comment.trim()) {
    bonusPoints += 10;
  }

  console.log("Calculated bonus points:", bonusPoints);

  // Process tags - handle both array and string formats
  let processedTags = '';
  if (Array.isArray(tags)) {
    processedTags = tags.join(',');
  } else if (typeof tags === 'string') {
    processedTags = tags;
  }

  console.log("Processed tags:", processedTags);

  // First, check if user is registered for this program
  const checkRegistrationQuery = `
    SELECT sp.*, p.Title 
    FROM staff_program sp
    JOIN Program p ON sp.programID = p.ProgramID
    WHERE sp.staffID = ? AND sp.programID = ? AND sp.Status IN ('Registered', 'Upcoming')
  `;

  db.query(checkRegistrationQuery, [staffID, programID], (err, registrationResults) => {
    if (err) {
      console.error("Registration check error:", err);
      return res.status(500).json({ success: false, message: "Database error checking registration" });
    }

    if (registrationResults.length === 0) {
      console.log("ERROR: User not registered for this program or already completed");
      return res.status(400).json({ 
        success: false, 
        message: "You are not registered for this program or have already completed it" 
      });
    }

    console.log("Registration found:", registrationResults[0]);

    // Check if feedback already exists
    const checkFeedbackQuery = `
      SELECT * FROM Program_Feedback 
      WHERE staffID = ? AND ProgramID = ?
    `;

    db.query(checkFeedbackQuery, [staffID, programID], (err, existingFeedback) => {
      if (err) {
        console.error("Feedback check error:", err);
        return res.status(500).json({ success: false, message: "Database error checking existing feedback" });
      }

      if (existingFeedback.length > 0) {
        console.log("ERROR: Feedback already exists");
        return res.status(400).json({ success: false, message: "You have already submitted feedback for this program" });
      }

      // Insert feedback
      const insertQuery = `
        INSERT INTO Program_Feedback (staffID, ProgramID, Rating, Tags, Comments, Submitted_Date)
        VALUES (?, ?, ?, ?, ?, NOW())
      `;

      const insertParams = [
        staffID, 
        programID, 
        numericRating, 
        processedTags || '', 
        comment || ''
      ];

      console.log("Insert params:", insertParams);

      db.query(insertQuery, insertParams, (err, result) => {
        if (err) {
          console.error("Feedback Insert Error:", err);
          return res.status(500).json({ 
            success: false, 
            message: "Failed to save feedback",
            error: err.message 
          });
        }

        console.log("Feedback inserted successfully, ID:", result.insertId);

        // Update program status to completed
        const updateStatusQuery = `
          UPDATE staff_program 
          SET Status = 'Completed', feedbackSubmitted = 1 
          WHERE staffID = ? AND programID = ?
        `;

        db.query(updateStatusQuery, [staffID, programID], (err2) => {
          if (err2) {
            console.error("Update Status Error:", err2);
            // Don't return error here, feedback was saved successfully
          } else {
            console.log("Program status updated to completed");
          }

          // Update points - get current program points first
          const getProgramPointsQuery = `
            SELECT points_reward FROM Program WHERE ProgramID = ?
          `;

          db.query(getProgramPointsQuery, [programID], (err3, programResults) => {
            if (err3) {
              console.error("Get program points error:", err3);
            }

            const programPoints = programResults.length > 0 ? programResults[0].points_reward : 0;
            const totalPoints = programPoints + bonusPoints;

            console.log("Program points:", programPoints, "Bonus points:", bonusPoints, "Total:", totalPoints);

            const updatePointsQuery = `
              UPDATE Staff SET total_point = total_point + ? WHERE staffID = ?
            `;

            db.query(updatePointsQuery, [totalPoints, staffID], (err4) => {
              if (err4) {
                console.error("Update Points Error:", err4);
                // Don't return error, feedback was saved successfully
              } else {
                console.log("Points updated successfully");
              }

              console.log("=== FEEDBACK SUBMISSION SUCCESS ===");
              return res.json({ 
                success: true, 
                message: "Feedback submitted successfully!",
                pointsEarned: totalPoints
              });
            });
          });
        });
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