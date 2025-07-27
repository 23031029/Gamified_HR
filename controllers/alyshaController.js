const db = require('../db');

// Helper: Get all program types
function getProgramTypes(cb) {
    db.query('SELECT typeID, name FROM Program_Type', cb);
}

// Admin - List all programs (with timeslot info)
exports.getProgramsAdmin = (req, res) => {
    const status = req.query.status;
    let query = `
        SELECT 
            p.ProgramID, p.Title, pt.name AS Type, p.points_reward, p.Created_By, 
            CONCAT(s.first_name, " ", s.last_name) AS name,
            t.Date, t.Start_Time, t.Duration, 
            ADDTIME(t.Start_Time, SEC_TO_TIME(t.Duration * 60)) AS End_Time,
            t.Slots_availablility, t.timeslotID,
            p.status
        FROM Program p
        LEFT JOIN Staff s ON s.staffID = p.Created_By
        LEFT JOIN Timeslot t ON t.ProgramID = p.ProgramID
        LEFT JOIN Program_Type pt ON pt.typeID = p.typeID
    `;
    const params = [];
    if (status === 'Active' || status === 'Inactive') {
        query += ' WHERE p.status = ?';
        params.push(status);
    }
    query += `
        ORDER BY 
          CASE WHEN p.status = 'Active' THEN 0 ELSE 1 END, 
          p.ProgramID ASC, t.Date ASC
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

    db.query(query, params, (err, programs) => {
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
                    status: p.status, 
                    timeslots: []
                };
            }

            // Include timeslot information if it exists
            if (p.Date && p.Start_Time && p.End_Time) {
                grouped[p.ProgramID].timeslots.push({
                    timeslotID: p.timeslotID, // This is crucial for QR code generation
                    date: new Date(p.Date).toLocaleDateString(),
                    startTime: p.Start_Time.substring(0, 5),
                    endTime: p.End_Time.substring(0, 5),
                    slots: p.Slots_availablility,
                    // Additional data that might be useful for QR codes
                    fullDate: p.Date,
                    fullStartTime: p.Start_Time,
                    duration: p.Duration
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
                currentPath: req.path,
                status // pass to EJS
            });
        });
    });
};

// Optional: Add a separate method for generating QR codes server-side
exports.generateQRCode = async (req, res) => {
    const { timeslotID } = req.params;
    const staffID = req.session.staff?.staffID;
    
    try {
        // Get detailed timeslot information
        const timeslotQuery = `
            SELECT 
                t.timeslotID,
                t.Date,
                t.Start_Time,
                t.Duration,
                t.Slots_availablility,
                p.Title,
                p.ProgramID,
                pt.name as Type,
                p.points_reward,
                p.status,
                CONCAT(s.first_name, " ", s.last_name) as created_by_name
            FROM Timeslot t
            JOIN Program p ON t.ProgramID = p.ProgramID
            JOIN Program_Type pt ON p.TypeID = pt.typeID
            JOIN Staff s ON p.Created_By = s.staffID
            WHERE t.timeslotID = ?
        `;
        
        db.query(timeslotQuery, [timeslotID], async (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Database error' 
                });
            }
            
            if (results.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Timeslot not found' 
                });
            }
            
            const timeslot = results[0];
            
            // Create the attendance URL
const attendanceUrl = `${req.protocol}://${req.get('host')}/user/attend?timeslotID=${timeslotID}`;

            
            // If you have QRCode library installed, generate QR code server-side
            // npm install qrcode
            try {
                const QRCode = require('qrcode');
                const qrDataURL = await QRCode.toDataURL(attendanceUrl, {
                    width: 300,
                    margin: 2,
                    color: {
                        dark: '#000000',
                        light: '#FFFFFF'
                    }
                });
                
                res.json({
                    success: true,
                    qrCode: qrDataURL,
                    timeslot: {
                        id: timeslot.timeslotID,
                        title: timeslot.Title,
                        programID: timeslot.ProgramID,
                        date: timeslot.Date,
                        startTime: timeslot.Start_Time,
                        duration: timeslot.Duration,
                        type: timeslot.Type,
                        points: timeslot.points_reward,
                        status: timeslot.status,
                        createdBy: timeslot.created_by_name,
                        availableSlots: timeslot.Slots_availablility
                    },
                    attendanceUrl
                });
            } catch (qrError) {
                console.error('QR generation error:', qrError);
                
                // Fallback: return data without QR code, let client generate it
                res.json({
                    success: true,
                    qrCode: null,
                    timeslot: {
                        id: timeslot.timeslotID,
                        title: timeslot.Title,
                        programID: timeslot.ProgramID,
                        date: timeslot.Date,
                        startTime: timeslot.Start_Time,
                        duration: timeslot.Duration,
                        type: timeslot.Type,
                        points: timeslot.points_reward,
                        status: timeslot.status,
                        createdBy: timeslot.created_by_name,
                        availableSlots: timeslot.Slots_availablility
                    },
                    attendanceUrl,
                    message: 'QR code will be generated client-side'
                });
            }
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Server error' 
        });
    }
};

exports.markAttendance = (req, res) => {
  const staffID = req.session.staff?.staffID; 
  const { timeslotID } = req.query;

  if (!staffID) {
    return res.status(401).send("🚫 Unauthorized. Please log in.");
  }

  if (!timeslotID) {
    return res.redirect('/user/scan?error=invalid_qr');
  }

  // First, get comprehensive timeslot and registration information
  const validationQuery = `
    SELECT 
      t.timeslotID,
      t.Date,
      t.Start_Time,
      t.Duration,
      p.Title as program_title,
      p.status as program_status,
      sp.staffID as registered_staff,
      sp.Status as current_status,
      CONCAT(t.Date, ' ', t.Start_Time) as start_datetime,
      DATE_ADD(CONCAT(t.Date, ' ', t.Start_Time), INTERVAL t.Duration MINUTE) as end_datetime,
      DATE_ADD(CONCAT(t.Date, ' ', t.Start_Time), INTERVAL (t.Duration + 15) MINUTE) as grace_end_datetime,
      p.points_reward
    FROM Timeslot t
    JOIN Program p ON t.ProgramID = p.ProgramID
    LEFT JOIN staff_program sp ON sp.timeslotID = t.timeslotID AND sp.staffID = ?
    WHERE t.timeslotID = ?
  `;

  db.query(validationQuery, [staffID, timeslotID], (err, results) => {
    if (err) {
      console.error('Validation query error:', err);
      return res.redirect('/user/scan?error=database_error');
    }

    if (results.length === 0) {
      return res.redirect('/user/scan?error=timeslot_not_found');
    }

    const timeslot = results[0];
    const currentTime = new Date();
    const startTime = new Date(timeslot.start_datetime);
    const endTime = new Date(timeslot.end_datetime);
    const graceEndTime = new Date(timeslot.grace_end_datetime);

    // Validation 1: Check if staff is registered for this program
    if (!timeslot.registered_staff) {
      return res.redirect('/user/scan?error=not_registered');
    }

    // Validation 2: Check if attendance already marked
    if (timeslot.current_status === 'Completed') {
      return res.redirect('/user/scan?error=already_marked');
    }

    // Validation 3: Check if program is active
    if (timeslot.program_status !== 'active') {
      return res.redirect('/user/scan?error=program_inactive');
    }

    // Validation 4: Check if it's too early (more than 30 minutes before start)
    const thirtyMinutesBeforeStart = new Date(startTime.getTime() - 30 * 60 * 1000);
    if (currentTime < thirtyMinutesBeforeStart) {
      return res.redirect('/user/scan?error=too_early');
    }

    // Validation 5: Check if it's too late (more than 15 minutes after end)
    if (currentTime > graceEndTime) {
      return res.redirect('/user/scan?error=too_late');
    }

    // Validation 6: Check if it's before the program has started (but within 30 minutes)
    if (currentTime < startTime) {
      return res.redirect('/user/scan?error=program_not_started');
    }

    // All validations passed - mark attendance
    const updateStatusQuery = `
      UPDATE staff_program 
      SET Status = 'Completed' 
      WHERE staffID = ? AND timeslotID = ? AND Status != 'Completed'
    `;

    db.query(updateStatusQuery, [staffID, timeslotID], (err, result) => {
      if (err) {
        console.error('Attendance update error:', err);
        return res.redirect('/user/scan?error=database_error');
      }

      // Update staff points
      const addPointsQuery = `
        UPDATE Staff
        SET total_point = total_point + ?
        WHERE staffID = ?
      `;

      db.query(addPointsQuery, [timeslot.points_reward, staffID], (err3) => {
        if (err3) {
          console.error('Points update error:', err3);
          return res.redirect('/user/scan?error=points_error');
        }

        // Success - redirect to dashboard with success message
        res.redirect(`/user/dashboard?attendance=success&pointsEarned=${timeslot.points_reward}&program=${encodeURIComponent(timeslot.program_title)}`);
      });
    });
  });
};

exports.getScanQR = (req, res) => {
  const { error, attendance } = req.query;
  
  let errorMessage = '';
  
  if (error) {
    switch (error) {
      case 'not_registered':
        errorMessage = 'You did not register for this program beforehand';
        break;
      case 'already_marked':
        errorMessage = 'Attendance already marked for this program';
        break;
      case 'too_late':
        errorMessage = 'QR code expired - program ended more than 15 minutes ago';
        break;
      case 'too_early':
        errorMessage = 'QR code not yet active - too early to scan';
        break;
      case 'program_not_started':
        errorMessage = 'Program has not started yet - please wait';
        break;
      case 'program_inactive':
        errorMessage = 'This program is no longer active';
        break;
      case 'timeslot_not_found':
        errorMessage = 'Invalid QR code - timeslot not found';
        break;
      case 'invalid_qr':
        errorMessage = 'Invalid QR code format';
        break;
      case 'database_error':
        errorMessage = 'System error - please try again later';
        break;
      case 'points_error':
        errorMessage = 'Attendance marked but points update failed';
        break;
      default:
        errorMessage = 'An unknown error occurred';
    }
  }

  res.render('user/scan', {
    currentPath: req.path,
    errorMessage,
    hasError: !!error
  });
};

// =========================
// USER PROGRAMS PAGE
// =========================
exports.getProgramsUser = (req, res) => {
    const staffID = req.session.staff?.staffID;

    const programQuery = `
      SELECT 
        p.ProgramID, p.Title, p.Description, pt.name AS Type, p.points_reward,
        t.Date, t.Start_Time, t.Duration, t.Slots_availablility, t.timeslotID
      FROM Program p
      JOIN Program_type pt ON p.TypeID = pt.typeID
      JOIN Timeslot t ON t.ProgramID = p.ProgramID
      WHERE 
        (t.Date > CURDATE() OR (t.Date = CURDATE() AND t.Start_Time > CURTIME()))
        AND NOT EXISTS (
          SELECT 1 FROM staff_program sp 
          WHERE sp.staffID = ? AND sp.timeslotID = t.timeslotID
        )
      ORDER BY p.ProgramID ASC, t.Date ASC, t.Start_Time ASC
    `;

    const coworkersQuery = `
      SELECT staffID, concat(first_name," ", last_name) as name, department.name AS department_name
      FROM staff
      JOIN department ON staff.department = department.departmentID
    `;

    db.query(programQuery, [staffID], (err, results) => {
        if (err) {
            return res.render('user/programsUser', {
                programs: [],
                coworkers: [],
                error: 'Database error occurred',
                messageP: null,
                currentPath: req.path
            });
        }

        const programsMap = new Map();
        results.forEach(row => {
            const programId = row.ProgramID;
            if (!programsMap.has(programId)) {
                programsMap.set(programId, {
                    programID: row.ProgramID, 
                    Title: row.Title,
                    Description: row.Description,
                    Type: row.Type,
                    points_reward: row.points_reward,
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

        const programs = Array.from(programsMap.values());

        // Get coworkers for invite dropdown
        db.query(coworkersQuery, [staffID], (err2, coworkers) => {
            if (err2) {
                return res.render('user/programsUser', {
                    programs,
                    coworkers: [],
                    error: 'Error loading coworkers',
                    messageP: null,
                    currentPath: req.path
                });
            }

            // Fix: Properly get flash messages
            const successMessage = req.flash('successP');
            const errorMessage = req.flash('errorP');

            res.render('user/programsUser', {
                programs,
                coworkers,
                error: errorMessage.length > 0 ? errorMessage[0] : null,
                messageP: successMessage.length > 0 ? successMessage[0] : null,
                currentPath: req.path
            });
        });
    });
};
//Render add program form
exports.getAddProgram = (req, res) => {
    const query = `SELECT ProgramID FROM Program ORDER BY ProgramID DESC LIMIT 1`;
    getProgramTypes((err, types) => {
        if (err) {
            req.flash('errorP', 'Error loading program types');
            return res.redirect('/admin/programs');
        }
        db.query(query, (err2, result) => {
            if (err2) {
                req.flash('errorP', 'Error loading add program form');
                return res.redirect('/admin/programs');
            }
            let nextId = 'P001';
            if (result.length > 0) {
                const lastId = result[0].ProgramID;
                const numericPart = parseInt(lastId.slice(1)) + 1;
                nextId = 'P' + numericPart.toString().padStart(3, '0');
            }
            res.render('admin/addPrograms', { nextId, types, currentPath: req.path });
        });
    });
};

// Handle POST add program (with timeslot)
exports.postAddProgram = (req, res) => {
    const {
        title,
        description,
        typeID,
        other_type,
        points_reward,
        staffID,
        timeslot_date,
        timeslot_start,
        timeslot_slots,
        duration
    } = req.body;

    function proceedWithInsert(finalTypeID) {
        const getLastIdQuery = `SELECT ProgramID FROM Program ORDER BY ProgramID DESC LIMIT 1`;
        db.query(getLastIdQuery, (err, result) => {
            if (err) {
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
                (ProgramID, Title, Description, typeID, points_reward,Created_By) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            const programValues = [
                nextId,
                title,
                description,
                finalTypeID,
                points_reward,
                staffID,
            ];

            db.query(insertProgramQuery, programValues, (insertErr) => {
                if (insertErr) {
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
                            duration,
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
    }

    if (typeID === 'other' && other_type && other_type.trim()) {
        // Insert new type and use its ID
        db.query(
            'INSERT INTO Program_Type (name) VALUES (?)',
            [other_type.trim()],
            (err, result) => {
                if (err) {
                    console.error('Insert new type error:', err);
                    req.flash('errorP', 'Failed to add new program type.');
                    return res.redirect('/admin/programs');
                }
                proceedWithInsert(result.insertId);
            }
        );
    } else {
        proceedWithInsert(typeID);
    }
};


// Render edit form (with timeslot)
exports.getEditProgram = (req, res) => {
    const programID = req.params.id;
    const programQuery = `SELECT * FROM Program WHERE ProgramID = ?`;
    const timeslotQuery = `SELECT * FROM Timeslot WHERE ProgramID = ? ORDER BY Date, Start_Time`;
    const sql = `SELECT typeID, name FROM Program_Type`;

    getProgramTypes((err, types) => {
        if (err) {
            req.flash('errorP', 'Error loading program types');
            return res.redirect('/admin/programs');
        }
        db.query(programQuery, [programID], (err2, programResults) => {
            if (err2 || programResults.length === 0) {
                return res.status(404).send('Program not found');
            }
            db.query(timeslotQuery, [programID], (tsErr, timeslotResults) => {
                // You can also run the sql here if you want to fetch types directly:
                // db.query(sql, (typeErr, typeResults) => { ... });
                res.render('admin/editPrograms', {
                    program: programResults[0],
                    timeslots: timeslotResults,
                    types,
                    messageP: req.flash('successP')[0] || req.flash('error')[0] || null,
                    messageType: req.flash('errorP').length > 0 ? 'error' : (req.flash('successP').length > 0 ? 'successP' : null),
                    currentPath: req.path
                });
            });
        });
    });
};

// Handle POST edit program (with timeslot)
exports.postEditProgram = (req, res) => {
    const programId = req.params.id;
    let { title, typeID, description, points_reward, duration, other_type } = req.body;

    if (!title || !typeID || !description || !points_reward || !duration) {
        req.flash('errorP', 'All fields are required');
        return res.redirect(`/programs/edit/${programId}`);
    }

    // If user selected "Other", insert new type and get its ID
    function proceedWithUpdate(finalTypeID) {
        const updateProgramQuery = `
            UPDATE Program 
            SET Title = ?, typeID = ?, Description = ?, points_reward = ?
            WHERE ProgramID = ?
        `;
        const values = [title, finalTypeID, description, points_reward, programId];

        db.query(updateProgramQuery, values, (err, result) => {
            if (err) {
                console.error('Program update error:', err);
                req.flash('errorP', 'Database error occurred while updating program.');
                return res.redirect(`/programs/edit/${programId}`);
            }

            if (result.affectedRows === 0) {
                req.flash('errorP', 'Program not found or no changes made.');
                return res.redirect(`/programs/edit/${programId}`);
            }

            // Extract timeslot fields 
            const {
                'timeslotID[]': timeslotID = [],
                'timeslot_date[]': timeslot_date = [],
                'timeslot_start[]': timeslot_start = [],
                'timeslot_slots[]': timeslot_slots = []
            } = req.body;

            // Normalize fields as arrays
            const tsIDs = Array.isArray(timeslotID) ? timeslotID : [timeslotID];
            const tsDates = Array.isArray(timeslot_date) ? timeslot_date : [timeslot_date];
            const tsStarts = Array.isArray(timeslot_start) ? timeslot_start : [timeslot_start];
            const tsSlots = Array.isArray(timeslot_slots) ? timeslot_slots : [timeslot_slots];

            let promises = [];

            for (let i = 0; i < tsDates.length; i++) {
                if (tsDates[i] && tsStarts[i] && tsSlots[i]) {
                    const slots = parseInt(tsSlots[i]);
                    const start = tsStarts[i];
                    const date = tsDates[i];
                    const dur = parseInt(duration);

                    if (tsIDs[i]) {
                        // Update existing timeslot
                        promises.push(new Promise((resolve, reject) => {
                            db.query(
                                `UPDATE Timeslot 
                                 SET Date = ?, Start_Time = ?, Duration = ?, Slots_availablility = ? 
                                 WHERE timeslotID = ?`,
                                [date, start, dur, slots, tsIDs[i]],
                                (err, result) => {
                                    if (err) {
                                        console.error('Timeslot update error:', err);
                                        reject(err);
                                    } else {
                                        resolve();
                                    }
                                }
                            );
                        }));
                    } else {
                        // Insert new timeslot
                        promises.push(new Promise((resolve, reject) => {
                            db.query(
                                `INSERT INTO Timeslot (ProgramID, Date, Start_Time, Duration, Slots_availablility) 
                                 VALUES (?, ?, ?, ?, ?)`,
                                [programId, date, start, dur, slots],
                                (err, result) => {
                                    if (err) {
                                        console.error('Timeslot insert error:', err);
                                        reject(err);
                                    } else {
                                        resolve();
                                    }
                                }
                            );
                        }));
                    }
                }
            }

            if (promises.length > 0) {
                Promise.all(promises)
                    .then(() => {
                        req.flash('successP', 'Program and timeslots updated successfully!');
                        res.redirect('/admin/programs');
                    })
                    .catch((error) => {
                        console.error('Timeslot operation failed:', error);
                        req.flash('errorP', 'Program updated, but failed to update/add some timeslots.');
                        res.redirect(`/programs/edit/${programId}`);
                    });
            } else {
                req.flash('successP', 'Program updated successfully!');
                res.redirect('/admin/programs');
            }
        });
    }

    if (typeID === 'other' && other_type && other_type.trim()) {
        // Insert new type and use its ID
        db.query(
            'INSERT INTO Program_Type (name) VALUES (?)',
            [other_type.trim()],
            (err, result) => {
                if (err) {
                    console.error('Insert new type error:', err);
                    req.flash('errorP', 'Failed to add new program type.');
                    return res.redirect(`/programs/edit/${programId}`);
                }
                proceedWithUpdate(result.insertId);
            }
        );
    } else {
        proceedWithUpdate(typeID);
    }
};


exports.joinProgram = (req, res) => {
  const { programID, timeslotID } = req.body;
  const staffID = req.session.staff && req.session.staff.staffID;

  if (!programID || !timeslotID || !staffID) {
    req.flash('errorP', 'Missing required information. Please try again.');
    return res.redirect('/user/programs');
  }

  const timeslotQuery = `
    SELECT Date, Start_Time, Duration, Slots_availablility 
    FROM Timeslot 
    WHERE timeslotID = ? AND ProgramID = ?
  `;

  db.query(timeslotQuery, [timeslotID, programID], (err1, slotResults) => {
    if (err1 || slotResults.length === 0) {
      console.error(err1 || 'Invalid timeslot');
      req.flash('errorP', 'Invalid or missing timeslot.');
      return res.redirect('/user/programs');
    }

    const slot = slotResults[0];
    const slotStart = new Date(`${slot.Date}T${slot.Start_Time}`);
    const slotEnd = new Date(slotStart.getTime() + slot.Duration * 60000);
    const now = new Date();

    if (slotStart <= now) {
      req.flash('errorP', 'This timeslot has already passed.');
      return res.redirect('/user/programs');
    }

    if (slot.Slots_availablility <= 0) {
      req.flash('errorP', 'This timeslot is fully booked.');
      return res.redirect('/user/programs');
    }

    const conflictQuery = `
      SELECT t.Date, t.Start_Time, t.Duration, sp.timeslotID
      FROM staff_program sp
      JOIN Timeslot t ON sp.timeslotID = t.timeslotID
      WHERE sp.staffID = ?
        AND t.Date = ?
    `;

    db.query(conflictQuery, [staffID, slot.Date], (err2, existingSlots) => {
      if (err2) {
        console.error(err2);
        req.flash('errorP', 'Database error occurred.');
        return res.redirect('/user/programs');
      }

      for (const existing of existingSlots) {
        const existingStart = new Date(`${existing.Date}T${existing.Start_Time}`);
        const existingEnd = new Date(existingStart.getTime() + existing.Duration * 60000);

        const overlap = slotStart < existingEnd && existingStart < slotEnd;
        if (overlap) {
          req.flash('errorP', 'You have already registered for a conflicting timeslot.');
          return res.redirect('/user/programs');
        }
      }

      // ✅ New status logic based on whether the program is today
      const isToday =
        slotStart.getFullYear() === now.getFullYear() &&
        slotStart.getMonth() === now.getMonth() &&
        slotStart.getDate() === now.getDate();

      const status = isToday ? 'Upcoming' : 'Registered';

      const insertQuery = `
        INSERT INTO staff_program (staffID, programID, timeslotID, Status) 
        VALUES (?, ?, ?, ?)
      `;

      db.query(insertQuery, [staffID, programID, timeslotID, status], (err3) => {
        if (err3) {
          console.error(err3);
          req.flash('errorP', 'Failed to register for program.');
          return res.redirect('/user/programs');
        }

        const updateSlotQuery = `
          UPDATE Timeslot 
          SET Slots_availablility = Slots_availablility - 1 
          WHERE timeslotID = ?
        `;

        db.query(updateSlotQuery, [timeslotID], (err4) => {
          if (err4) {
            console.error(err4);
            req.flash('errorP', 'Failed to update slot availability.');
            return res.redirect('/user/programs');
          }

          req.flash('successP', `Successfully registered${status === 'Upcoming' ? ' (Upcoming)' : ''}!`);
          return res.redirect('/user/programs');
        });
      });
    });
  });
};



exports.toggleProgramStatus = (req, res) => {
    const programID = req.params.id;
    const action = req.body.action;
    if (action === 'deactivate') {
        db.query('UPDATE Program SET status = "Inactive" WHERE ProgramID = ?', [programID], (err) => {
            if (err) req.flash('errorP', 'Failed to deactivate program.');
            else req.flash('successP', 'Program deactivated.');
            res.redirect('/admin/programs');
        });
    } else if (action === 'activate') {
        db.query('UPDATE Program SET status = "Active" WHERE ProgramID = ?', [programID], (err) => {
            if (err) req.flash('errorP', 'Failed to activate program.');
            else req.flash('successP', 'Program activated.');
            res.redirect('/admin/programs');
        });
    } else {
        req.flash('errorP', 'Invalid action.');
        res.redirect('/admin/programs');
    }
};

exports.cancelProgram = (req, res) => {
    const participantID = req.params.participantID;
    const cancelSQL = `UPDATE staff_program SET Status = 'Cancelled' WHERE participantID = ?`;
    
    db.query(cancelSQL, [participantID], (err, result) => {
        if (err) throw err;
        res.redirect('/user/dashboard');
    });
};
