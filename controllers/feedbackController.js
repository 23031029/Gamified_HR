const db = require('../db');
const updateProgramStatus = require('../realtimeUpdates');

//Viewing Program
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


//Post Feedback
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
  let processedTags = '';
  if (Array.isArray(tags)) {
    processedTags = tags.join(',');
  } else if (typeof tags === 'string') {
    processedTags = tags;
  }

  console.log("Processed tags:", processedTags);
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
        const updateStatusQuery = `
          UPDATE staff_program 
          SET Status = 'Completed', feedbackSubmitted = 1 
          WHERE staffID = ? AND programID = ?
        `;

        db.query(updateStatusQuery, [staffID, programID], (err2) => {
          if (err2) {
            console.error("Update Status Error:", err2);
          } else {
            console.log("Program status updated to completed");
          }
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

//Get Feedback
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

exports.exportFeedbackData = (req, res) => {
  const { programID } = req.query; 

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

// exports.exportFeedbackData = (req, res) => {
//   const { programID } = req.query; // for optional filtering

//   let query = `
//     SELECT pf.FeedbackID, 
//            CONCAT(s.first_name, ' ', s.last_name) AS StaffName,
//            p.Title AS ProgramTitle,
//            pf.Rating, 
//            pf.Comments, 
//            pf.Submitted_Date
//     FROM Program_Feedback pf
//     JOIN Staff s ON pf.staffID = s.staffID
//     JOIN Program p ON pf.ProgramID = p.ProgramID
//   `;
//   const params = [];

//   if (programID) {
//     query += ` WHERE pf.ProgramID = ?`;
//     params.push(programID);
//   }

//   query += ` ORDER BY pf.Submitted_Date DESC`;

//   db.query(query, async (err, results) => {
//     if (err) {
//       console.error("Error exporting feedback:", err);
//       return res.status(500).send("Error generating Excel file");
//     }

//     const workbook = new ExcelJS.Workbook();
//     const worksheet = workbook.addWorksheet("Program Feedback");

//     worksheet.columns = [
//       { header: "Feedback ID", key: "FeedbackID", width: 12 },
//       { header: "Staff Name", key: "StaffName", width: 25 },
//       { header: "Program Title", key: "ProgramTitle", width: 25 },
//       { header: "Rating", key: "Rating", width: 10 },
//       { header: "Comments", key: "Comments", width: 40 },
//       { header: "Submitted Date", key: "Submitted_Date", width: 15 },
//     ];

//     worksheet.addRows(results);

//     res.setHeader(
//       "Content-Type",
//       "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
//     );
//     res.setHeader(
//       "Content-Disposition",
//       `attachment; filename=${programID ? 'feedback_' + programID : 'all_feedback'}.xlsx`
//     );

//     await workbook.xlsx.write(res);
//     res.end();
//   });
// };




// =========================
// HELPER FUNCTIONS
// =========================


// exports.getAllPrograms = (req, res) => {
//   const sql = `
//     SELECT p.*, 
//            CONCAT(s.first_name, ' ', s.last_name) AS created_by_name,
//            d.name AS creator_department
//     FROM Program p
//     JOIN Staff s ON p.Created_By = s.staffID
//     JOIN Department d ON s.department = d.departmentID
//     ORDER BY p.Start_Date DESC
//   `;

//   db.query(sql, (err, results) => {
//     if (err) return res.status(500).send("Error fetching programs");
//     res.render('programs/list', {
//       programs: results,
//       currentPath: req.path
//     });
//   });
// };

// exports.getProgramFeedback = (req, res) => {
//   const programID = req.params.programID;

//   const sql = `
//     SELECT pf.*, 
//            CONCAT(s.first_name, ' ', s.last_name) AS staff_name,
//            p.Title AS program_title
//     FROM Program_Feedback pf
//     JOIN Staff s ON pf.staffID = s.staffID
//     JOIN Program p ON pf.ProgramID = p.ProgramID
//     WHERE pf.ProgramID = ?
//     ORDER BY pf.Submitted_Date DESC
//   `;

//   db.query(sql, [programID], (err, results) => {
//     if (err) return res.status(500).send("Error fetching feedback");
//     res.json({ success: true, feedback: results });
//   });
// };

// exports.getStaffParticipation = (req, res) => {
//   const staffID = req.params.staffID || req.session.staff.staffID;

//   const sql = `
//     SELECT sp.*, p.Title, p.Type, p.Start_Date, p.End_Date
//     FROM staff_program sp
//     JOIN Program p ON sp.programID = p.ProgramID
//     WHERE sp.staffID = ?
//     ORDER BY sp.completed_date DESC
//   `;

//   db.query(sql, [staffID], (err, results) => {
//     if (err) return res.status(500).send("Error fetching participation history");
//     res.json({ success: true, participation: results });
//   });
// };

// exports.getRedemptionHistory = (req, res) => {
//   const staffID = req.params.staffID || req.session.staff.staffID;

//   const sql = `
//     SELECT r.*, 
//            re.Redeem_Date,
//            re.RedemptionID
//     FROM Redeem re
//     JOIN Reward r ON re.RewardID = r.RewardID
//     WHERE re.staffID = ?
//     ORDER BY re.Redeem_Date DESC
//   `;

//   db.query(sql, [staffID], (err, results) => {
//     if (err) return res.status(500).send("Error fetching redemption history");
//     res.json({ success: true, redemptions: results });
//   });
// };