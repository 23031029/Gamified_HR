const db = require('../db');

// Admin - List all programs (with timeslot info)
exports.getProgramsAdmin = (req, res) => {
    const query = `
        SELECT 
    p.ProgramID, p.Title, p.Type, p.points_reward, p.Created_By, 
    CONCAT(s.first_name, " ", s.last_name) AS name,
    t.Date, 
    t.Start_Time, 
    t.Duration, 
    ADDTIME(t.Start_Time, SEC_TO_TIME(t.Duration * 60)) AS End_Time,
    t.Slots_availablility, 
    t.timeslotID
FROM Program p
LEFT JOIN Staff s ON s.staffID = p.Created_By
LEFT JOIN Timeslot t ON t.ProgramID = p.ProgramID
ORDER BY p.ProgramID ASC, t.Date ASC;

    `;

    const feedbackStatsQuery = `
        SELECT 
            pf.ProgramID,
            p.Title,
            ROUND(AVG(pf.Rating), 1) AS avg_rating,
            COUNT(pf.FeedbackID) AS comment_count
        FROM Program_Feedback pf
        JOIN Program p ON pf.ProgramID = p.ProgramID
        GROUP BY pf.ProgramID, p.Title
    `;

    db.query(query, (err, programs) => {
        if (err) {
            console.error(err);
            req.flash('errorP', 'Error fetching programs');
            return res.redirect('/admin/programs');
        }

        const grouped = {};
        programs.forEach(p => {
            if (!grouped[p.ProgramID]) {
                grouped[p.ProgramID] = {
                    ProgramID: p.ProgramID,
                    Title: p.Title,
                    Type: p.Type,
                    Duration: p.Duration,
                    points_reward: p.points_reward,
                    Created_By: p.Created_By,
                    name: p.name,
                    timeslots: []
                };
            }

            if (p.Date && p.Start_Time && p.End_Time) {
                grouped[p.ProgramID].timeslots.push({
                    date: new Date(p.Date).toLocaleDateString(),
                    startTime: p.Start_Time.substring(0, 5),
                    endTime: p.End_Time.substring(0, 5),
                    slots: p.Slots_availablility
                });
            }
        });

        const groupedPrograms = Object.values(grouped);

        db.query(feedbackStatsQuery, (err2, feedbackStats) => {
            if (err2) {
                console.error(err2);
                req.flash('errorP', 'Error fetching feedback data');
                return res.redirect('/admin/programs');
            }

            const successMessage = req.flash('successP');
            const errorMessage = req.flash('errorP');

            res.render('admin/programsAdmin', {
                programs: groupedPrograms,
                feedbackStats: feedbackStats || [],
                error: null,
                messageP: successMessage.length > 0 ? successMessage[0] : (errorMessage.length > 0 ? errorMessage[0] : null),
                messageType: successMessage.length > 0 ? 'success' : (errorMessage.length > 0 ? 'error' : null),
                currentPath: req.path
            });
        });
    });
};

exports.getProgramsUser = (req, res) => {
    const query = `
        SELECT 
            p.ProgramID, p.Title, p.Description, p.Type, p.points_reward, p.QR_code,
            t.Date, t.Start_Time, t.Duration, t.Slots_availablility, t.timeslotID
        FROM Program p
        LEFT JOIN Timeslot t ON t.ProgramID = p.ProgramID
        WHERE 
            (t.Date > CURDATE())
            OR (t.Date = CURDATE() && t.Start_Time > CURTIME())
            OR t.Date IS NULL
        ORDER BY p.ProgramID ASC, t.Date ASC, t.Start_Time ASC
    `;
    
    db.query(query, (err, results) => {
        if (err) {
            return res.render('user/programsUser', {
                programs: [],
                error: err,
                messageP: req.flash('successP'),
                currentPath: req.path
            });
        }

        // Group timeslots by program
        const programsMap = new Map();
        
        results.forEach(row => {
            const programId = row.ProgramID;
            
            if (!programsMap.has(programId)) {
                programsMap.set(programId, {
                    ProgramID: row.ProgramID,
                    Title: row.Title,
                    Description: row.Description,
                    Type: row.Type,
                    points_reward: row.points_reward,
                    QR_code: row.QR_code,
                    timeslots: []
                });
            }

            if (row.timeslotID) {
                programsMap.get(programId).timeslots.push({
                    timeslotID: row.timeslotID,
                    Date: row.Date,
                    Start_Time: row.Start_Time,
                    Duration: row.Duration,
                    Slots_availablility: row.Slots_availablility
                });
            }
        });

        // Convert map to array
        const programs = Array.from(programsMap.values());

        res.render('user/programsUser', {
            programs,
            error: null,
            messageP: req.flash('successP'),
            currentPath: req.path
        });
    });
};
// Render add program form
exports.getAddProgram = (req, res) => {
  const query = `SELECT ProgramID FROM Program ORDER BY ProgramID DESC LIMIT 1`;
  db.query(query, (err, result) => {
    if (err) {
      console.error('Error fetching last ProgramID:', err);
      req.flash('errorP', 'Error loading add program form');
      return res.redirect('/admin/programs');
    }
    let nextId = 'P001';
    if (result.length > 0) {
      const lastId = result[0].ProgramID;
      const numericPart = parseInt(lastId.slice(1)) + 1;
      nextId = 'P' + numericPart.toString().padStart(3, '0');
    }
    res.render('admin/addPrograms', { nextId, currentPath: req.path });
  });
};

// Handle POST add program (with timeslot)
exports.postAddProgram = (req, res) => {
  const {
    title,
    description,
    type,
    points_reward,
    staffID,
    timeslot_date,
    timeslot_start,
    timeslot_slots,
    duration // shared duration
  } = req.body;

  let QR_code = null;
  if (req.file) QR_code = req.file.filename;

  const getLastIdQuery = `SELECT ProgramID FROM Program ORDER BY ProgramID DESC LIMIT 1`;
  db.query(getLastIdQuery, (err, result) => {
    if (err) {
      console.error('Error fetching last ProgramID:', err);
      req.flash('errorP', 'Error processing program');
      return res.redirect('/admin/programs');
    }

    let nextId = 'P001';
    if (result.length > 0) {
      const lastId = result[0].ProgramID;
      const numericPart = parseInt(lastId.slice(1)) + 1;
      nextId = 'P' + numericPart.toString().padStart(3, '0');
    }

    const insertProgramQuery = `
      INSERT INTO Program 
      (ProgramID, Title, Description, Type, points_reward, QR_code, Created_By) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const programValues = [
      nextId,
      title,
      description,
      type,
      points_reward,
      QR_code,
      staffID,
    ];

    db.query(insertProgramQuery, programValues, (insertErr) => {
      if (insertErr) {
        console.error('Insert Program Error:', insertErr);
        req.flash('errorP', 'Error saving program');
        return res.redirect('/admin/programs');
      }

      // Normalize timeslot arrays
      const dates = Array.isArray(timeslot_date) ? timeslot_date : [timeslot_date];
      const starts = Array.isArray(timeslot_start) ? timeslot_start : [timeslot_start];
      const slots = Array.isArray(timeslot_slots) ? timeslot_slots : [timeslot_slots];

      let timeslotInserts = [];
      for (let i = 0; i < dates.length; i++) {
        if (dates[i] && starts[i] && slots[i]) {
          timeslotInserts.push([
            nextId,
            dates[i],
            starts[i],
            duration, // shared duration
            slots[i],
          ]);
        }
      }

      if (timeslotInserts.length > 0) {
        const insertTimeslotQuery = `
          INSERT INTO Timeslot (ProgramID, Date, Start_Time, Duration, Slots_availablility)
          VALUES ?
        `;
        db.query(insertTimeslotQuery, [timeslotInserts], (tsErr) => {
          if (tsErr) {
            console.error('Insert Timeslot Error:', tsErr);
            req.flash('errorP', 'Program added, but error saving timeslots');
            return res.redirect('/admin/programs');
          }
          req.flash('successP', 'Program and timeslots added successfully!');
          res.redirect('/admin/programs');
        });
      } else {
        req.flash('successP', 'Program added successfully!');
        res.redirect('/admin/programs');
      }
    });
  });
};


// Render edit form (with timeslot)
exports.getEditProgram = (req, res) => {
    const programID = req.params.id;
    // Get program info
    const programQuery = `SELECT * FROM Program WHERE ProgramID = ?`;
    // Get all timeslots for this program
    const timeslotQuery = `SELECT * FROM Timeslot WHERE ProgramID = ? ORDER BY Date, Start_Time`;

    db.query(programQuery, [programID], (err, programResults) => {
        if (err || programResults.length === 0) {
            return res.status(404).send('Program not found');
        }
        db.query(timeslotQuery, [programID], (tsErr, timeslotResults) => {
            res.render('admin/editPrograms', {
                program: programResults[0],
                timeslots: timeslotResults,
                messageP: req.flash('successP')[0] || req.flash('error')[0] || null,
                messageType: req.flash('errorP').length > 0 ? 'error' : (req.flash('successP').length > 0 ? 'successP' : null),
                currentPath: req.path
            });
        });
    });
};

// Handle POST edit program (with timeslot)
exports.postEditProgram = (req, res) => {
    const programId = req.params.id;
    const { title, type, description, points_reward } = req.body;
    // Timeslot fields as arrays
    const timeslotID = req.body.timeslotID || [];
    const timeslot_date = req.body.timeslot_date || [];
    const timeslot_start = req.body.timeslot_start || [];
    const timeslot_duration = req.body.timeslot_duration || [];
    const timeslot_slots = req.body.timeslot_slots || [];

    if (!title || !type || !description || !points_reward) {
        req.flash('errorP', 'All fields are required');
        return res.redirect(`/programs/edit/${programId}`);
    }
    const updateProgramQuery = `
        UPDATE Program 
        SET Title = ?, Type = ?, Description = ?, points_reward = ?
        WHERE ProgramID = ?
    `;
    const values = [title, type, description, points_reward, programId];
    db.query(updateProgramQuery, values, (err) => {
        if (err) {
            req.flash('errorP', 'Failed to update program. Please try again.');
            return res.redirect(`/programs/edit/${programId}`);
        }
        // Update or insert timeslots
        let updates = [];
        let inserts = [];
        // Ensure all timeslot fields are arrays
        const tsIDs = Array.isArray(timeslotID) ? timeslotID : [timeslotID];
        const tsDates = Array.isArray(timeslot_date) ? timeslot_date : [timeslot_date];
        const tsStarts = Array.isArray(timeslot_start) ? timeslot_start : [timeslot_start];
        const tsDurations = Array.isArray(timeslot_duration) ? timeslot_duration : [timeslot_duration];
        const tsSlots = Array.isArray(timeslot_slots) ? timeslot_slots : [timeslot_slots];

        for (let i = 0; i < tsDates.length; i++) {
            if (tsDates[i] && tsStarts[i] && tsDurations[i] && tsSlots[i]) {
                if (tsIDs[i]) {
                    // Existing timeslot, update
                    updates.push(new Promise((resolve, reject) => {
                        db.query(
                            `UPDATE Timeslot SET Date=?, Start_Time=?, Duration=?, Slots_availablility=? WHERE timeslotID=?`,
                            [tsDates[i], tsStarts[i], tsDurations[i], tsSlots[i], tsIDs[i]],
                            (err) => err ? reject(err) : resolve()
                        );
                    }));
                } else {
                    // New timeslot, insert
                    inserts.push(new Promise((resolve, reject) => {
                        db.query(
                            `INSERT INTO Timeslot (ProgramID, Date, Start_Time, Duration, Slots_availablility) VALUES (?, ?, ?, ?, ?)`,
                            [programId, tsDates[i], tsStarts[i], tsDurations[i], tsSlots[i]],
                            (err) => err ? reject(err) : resolve()
                        );
                    }));
                }
            }
        }
        Promise.all([...updates, ...inserts])
            .then(() => {
                req.flash('successP', 'Program and timeslots updated successfully!');
                res.redirect('/admin/programs');
            })
            .catch(() => {
                req.flash('errorP', 'Program updated, but failed to update/add timeslots.');
                res.redirect(`/programs/edit/${programId}`);
            });
    });
};

// Delete a program (and its timeslots)
exports.deleteProgram = (req, res) => {
    const programID = req.params.id;
    const deleteTimeslots = 'DELETE FROM Timeslot WHERE ProgramID = ?';
    db.query(deleteTimeslots, [programID], (relErr) => {
        const deleteQuery = 'DELETE FROM Program WHERE ProgramID = ?';
        db.query(deleteQuery, [programID], (deleteErr) => {
            return res.redirect(`/admin/programs`);
        });
    });
};

exports.joinProgram = (req, res) => {
  const { programID, timeslotID } = req.body;
  const staffID = req.session.staff && req.session.staff.staffID;

  if (!programID || !timeslotID || !staffID) {
    req.flash('errorP', 'Missing required information. Please try again.');
    return res.redirect('/user/programs');
  }

  // 1. Check if staff already registered for the program
  const checkExistingQuery = `
    SELECT participantID 
    FROM staff_program 
    WHERE staffID = ? AND programID = ?
  `;

  db.query(checkExistingQuery, [staffID, programID], (err1, existingResults) => {
    if (err1) {
      console.error(err1);
      req.flash('error', 'Database error occurred.');
      return res.redirect('/user/programs');
    }

    if (existingResults.length > 0) {
      req.flash('error', 'You are already registered for this program.');
      return res.redirect('/user/programs');
    }

    // 2. Validate selected timeslot
    const checkSlotQuery = `
      SELECT Slots_availablility, Date, Start_Time 
      FROM Timeslot 
      WHERE timeslotID = ? AND ProgramID = ?
    `;

    db.query(checkSlotQuery, [timeslotID, programID], (err2, slotResults) => {
      if (err2) {
        console.error(err2);
        req.flash('error', 'Failed to retrieve timeslot.');
        return res.redirect('/user/programs');
      }

      if (slotResults.length === 0) {
        req.flash('error', 'Invalid timeslot selected.');
        return res.redirect('/user/programs');
      }

      const slot = slotResults[0];
      const now = new Date();
      const slotDateTime = new Date(`${slot.Date}T${slot.Start_Time}`);

      if (slotDateTime <= now) {
        req.flash('error', 'This timeslot has already passed.');
        return res.redirect('/user/programs');
      }

      if (slot.Slots_availablility <= 0) {
        req.flash('error', 'This timeslot is fully booked.');
        return res.redirect('/user/programs');
      }

      // 3. Determine status based on whether it's within next 3 days
      const oneDayMs = 24 * 60 * 60 * 1000;
      const diffMs = slotDateTime - now;
      const status = (diffMs <= 3 * oneDayMs) ? 'Upcoming' : 'Registered';

      // 4. Insert registration
      const insertQuery = `
        INSERT INTO staff_program (staffID, programID, timeslotID, Status) 
        VALUES (?, ?, ?, ?)
      `;

      db.query(insertQuery, [staffID, programID, timeslotID, status], (err4) => {
        if (err4) {
          console.error(err4);
          req.flash('error', 'Failed to register for program.');
          return res.redirect('/user/programs');
        }

        // 5. Update timeslot availability
        const updateSlotQuery = `
          UPDATE Timeslot 
          SET Slots_availablility = Slots_availablility - 1 
          WHERE timeslotID = ?
        `;

        db.query(updateSlotQuery, [timeslotID], (err5) => {
          if (err5) {
            console.error(err5);
            req.flash('error', 'Failed to update slot availability.');
            return res.redirect('/user/programs');
          }

          req.flash('successP', `Successfully registered${status === 'Upcoming' ? ' (Upcoming)' : ''}!`);
          return res.redirect('/user/programs');
        });
      });
    });
  });
};
