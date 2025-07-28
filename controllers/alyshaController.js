const db = require('../db');


// Helper: Get all program types
function getProgramTypes(cb) {
    db.query('SELECT typeID, name FROM Program_Type', cb);
}

// Admin - List all programs (with timeslot info) - FIXED QUERY
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
          p.ProgramID ASC, t.Date ASC, t.Start_Time ASC
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
            console.error('Programs query error:', err);
            req.flash('errorP', 'Error fetching programs');
            return res.redirect('/admin/programs');
        }

        console.log('Raw programs data:', programs); // Debug log

        const grouped = {};
        programs.forEach(p => {
            if (!grouped[p.ProgramID]) {
                grouped[p.ProgramID] = {
                    ProgramID: p.ProgramID,
                    Title: p.Title,
                    Type: p.Type,
                    Duration: p.Duration, // This should come from timeslot, not program
                    points_reward: p.points_reward,
                    Created_By: p.Created_By,
                    name: p.name,
                    status: p.status, 
                    timeslots: []
                };
            }

            // FIXED: Include timeslot information even if some fields are null
            if (p.timeslotID) {
                grouped[p.ProgramID].timeslots.push({
                    timeslotID: p.timeslotID,
                    date: p.Date ? new Date(p.Date).toLocaleDateString() : '-',
                    startTime: p.Start_Time ? p.Start_Time.substring(0, 5) : '-',
                    endTime: p.End_Time ? p.End_Time.substring(0, 5) : '-',
                    slots: p.Slots_availablility || '-',
                    // Additional data
                    fullDate: p.Date,
                    fullStartTime: p.Start_Time,
                    duration: p.Duration
                });
            }
        });

        const groupedPrograms = Object.values(grouped);
        console.log('Grouped programs:', JSON.stringify(groupedPrograms, null, 2)); // Debug log

        db.query(feedbackStatsQuery, (err2, feedbackStats) => {
            if (err2) {
                console.error('Feedback stats error:', err2);
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
                status
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

  console.log('=== ATTENDANCE DEBUG START ===');
  console.log('StaffID:', staffID);
  console.log('TimeslotID:', timeslotID);

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
      p.points_reward,
      p.ProgramID
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
      console.log('❌ No results found for timeslotID:', timeslotID);
      return res.redirect('/user/scan?error=timeslot_not_found');
    }

    const timeslot = results[0];
    console.log('📊 Database Results:');
    console.log('  Program Title:', timeslot.program_title);
    console.log('  Program Status (raw):', JSON.stringify(timeslot.program_status));
    console.log('  Program ID:', timeslot.ProgramID);
    console.log('  Registered Staff:', timeslot.registered_staff);
    console.log('  Current Status:', timeslot.current_status);
    console.log('  Date:', timeslot.Date);
    console.log('  Start Time:', timeslot.Start_Time);

    const currentTime = new Date();
    const startTime = new Date(timeslot.start_datetime);
    const endTime = new Date(timeslot.end_datetime);
    const graceEndTime = new Date(timeslot.grace_end_datetime);

    console.log('⏰ Time Analysis:');
    console.log('  Current Time:', currentTime);
    console.log('  Current Time (ISO):', currentTime.toISOString());
    console.log('  Program Start:', startTime);
    console.log('  Program Start (ISO):', startTime.toISOString());
    console.log('  Raw start_datetime from DB:', timeslot.start_datetime);
    console.log('  Time difference (minutes):', (startTime.getTime() - currentTime.getTime()) / (1000 * 60));

    // Validation 1: Check if staff is registered for this program
    if (!timeslot.registered_staff) {
      console.log('❌ Staff not registered for this program');
      return res.redirect('/user/scan?error=not_registered');
    }
    console.log('✅ Staff is registered');

    // Validation 2: Check if attendance already marked
    if (timeslot.current_status === 'Completed') {
      console.log('❌ Attendance already marked');
      return res.redirect('/user/scan?error=already_marked');
    }
    console.log('✅ Attendance not yet marked');

    // Validation 3: Check if program is active
    const possibleActiveValues = ['active', 'Active', 'ACTIVE'];
    const isActive = possibleActiveValues.includes(timeslot.program_status?.toString().trim());
    
    if (!isActive) {
      console.log('❌ Program is not active. Status:', timeslot.program_status);
      return res.redirect('/user/scan?error=program_inactive');
    }
    console.log('✅ Program is active');

    // Validation 4: Check if it's too early (more than 30 minutes before start)
    const thirtyMinutesBeforeStart = new Date(startTime.getTime() - 30 * 60 * 1000);
    if (currentTime < thirtyMinutesBeforeStart) {
      console.log('❌ Too early to scan (more than 30 min before start)');
      return res.redirect('/user/scan?error=too_early');
    }
    console.log('✅ Not too early (within 30 minutes of start)');

    // Validation 5: Check if it's too late (more than 15 minutes after end)
    if (currentTime > graceEndTime) {
      console.log('❌ Too late to scan (more than 15 min after end)');
      return res.redirect('/user/scan?error=too_late');
    }
    console.log('✅ Not too late (within grace period)');

    // FIXED: Validation 6 - Allow early scanning within the 30-minute window
    const timeDiffMinutes = (startTime.getTime() - currentTime.getTime()) / (1000 * 60);
    console.log('🕐 Start Time Check:');
    console.log('  Time until start (minutes):', timeDiffMinutes);
    console.log('  Current < Start?', currentTime < startTime);
    
    // If program hasn't started yet, but we're within 30 minutes, that's okay
    // We already checked the 30-minute window above, so if we're here, we're good
    if (currentTime < startTime) {
      console.log('🟡 Program has not started yet, but within allowed window');
      console.log('  Minutes until start:', Math.ceil(timeDiffMinutes));
      console.log('  ✅ Allowing early attendance marking');
    } else {
      console.log('✅ Program has already started');
    }

    console.log('🎉 All validations passed! Proceeding with attendance marking...');

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

      if (result.affectedRows === 0) {
        console.log('⚠️ No rows updated - might already be completed');
      } else {
        console.log('✅ Attendance marked successfully');
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

        console.log('✅ Points updated successfully');
        console.log('=== ATTENDANCE DEBUG END ===');

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

        const staffQuery = `SELECT staffID, first_name, last_name FROM Staff WHERE staffID != ?`;

        db.query(staffQuery, [staffID], (err2, staffResults) => {
          if (err2) {
            return res.render('user/programsUser', {
              programs,
              allStaff: [],
              staff: req.session.staff,
              error: err2,
              messageP: req.flash('successP'),
              currentPath: req.path
            });
          }

          res.render('user/programsUser', {
            programs,
            allStaff: staffResults,
            staff: req.session.staff,
            error: null,
            messageP: req.flash('successP'),
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
    console.log('=== ADD PROGRAM DEBUG START ===');
    console.log('Full request body:', JSON.stringify(req.body, null, 2));
    
    const {
        title,
        description,
        typeID,
        other_type,
        points_reward,
        staffID,
        duration
    } = req.body;

    // Extract timeslot fields with different possible names
    const timeslot_date = req.body.timeslot_date || req.body['timeslot_date[]'] || [];
    const timeslot_start = req.body.timeslot_start || req.body['timeslot_start[]'] || [];
    const timeslot_slots = req.body.timeslot_slots || req.body['timeslot_slots[]'] || [];

    console.log('Extracted basic fields:', {
        title, description, typeID, other_type, points_reward, staffID, duration
    });
    
    console.log('Extracted timeslot fields:', {
        timeslot_date, timeslot_start, timeslot_slots
    });

    // Validation
    if (!title || !description || !typeID || !points_reward || !duration || !staffID) {
        console.log('❌ Missing required fields');
        req.flash('errorP', 'All fields are required');
        return res.redirect('/programs/add');
    }

    function proceedWithInsert(finalTypeID) {
        console.log('Proceeding with insert, finalTypeID:', finalTypeID);
        
        const getLastIdQuery = `SELECT ProgramID FROM Program ORDER BY ProgramID DESC LIMIT 1`;
        db.query(getLastIdQuery, (err, result) => {
            if (err) {
                console.error('❌ Get last ID error:', err);
                req.flash('errorP', 'Error processing program');
                return res.redirect('/admin/programs');
            }
            
            let nextId = 'P001';
            if (result.length > 0) {
                const lastId = result[0].ProgramID;
                const numericPart = parseInt(lastId.slice(1)) + 1;
                nextId = 'P' + numericPart.toString().padStart(3, '0');
            }

            console.log('✅ Generated Program ID:', nextId);

            const insertProgramQuery = `
                INSERT INTO Program 
                (ProgramID, Title, Description, typeID, points_reward, Created_By) 
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            const programValues = [
                nextId,
                title,
                description,
                finalTypeID,
                parseInt(points_reward),
                staffID
            ];

            console.log('Program insert query:', insertProgramQuery);
            console.log('Program insert values:', programValues);

            db.query(insertProgramQuery, programValues, (insertErr, programResult) => {
                if (insertErr) {
                    console.error('❌ Insert Program Error:', insertErr);
                    req.flash('errorP', 'Error saving program: ' + insertErr.message);
                    return res.redirect('/admin/programs');
                }

                console.log('✅ Program inserted successfully, result:', programResult);

                // Process timeslots
                console.log('Processing timeslots...');
                
                // Normalize timeslot arrays - handle both single values and arrays
                const dates = Array.isArray(timeslot_date) ? timeslot_date : (timeslot_date ? [timeslot_date] : []);
                const starts = Array.isArray(timeslot_start) ? timeslot_start : (timeslot_start ? [timeslot_start] : []);
                const slots = Array.isArray(timeslot_slots) ? timeslot_slots : (timeslot_slots ? [timeslot_slots] : []);

                console.log('Normalized arrays:', {
                    dates: dates,
                    starts: starts,
                    slots: slots,
                    duration: duration
                });

                // Validate we have data
                if (dates.length === 0 || starts.length === 0 || slots.length === 0) {
                    console.log('⚠️ No timeslot data found, but program was created');
                    req.flash('successP', 'Program created successfully, but no timeslots were added. Please edit the program to add timeslots.');
                    return res.redirect('/admin/programs');
                }

                // Validate array lengths match
                if (dates.length !== starts.length || starts.length !== slots.length) {
                    console.log('❌ Timeslot array length mismatch:', {
                        dates: dates.length,
                        starts: starts.length,
                        slots: slots.length
                    });
                    req.flash('errorP', 'Timeslot data is inconsistent. Program created but no timeslots added.');
                    return res.redirect('/admin/programs');
                }

                let timeslotInserts = [];
                for (let i = 0; i < dates.length; i++) {
                    const date = dates[i];
                    const start = starts[i];
                    const slot = slots[i];
                    
                    console.log(`Processing timeslot ${i + 1}:`, { date, start, slot, duration });
                    
                    // Skip empty entries
                    if (!date || !start || !slot) {
                        console.log(`⚠️ Skipping empty timeslot ${i + 1}`);
                        continue;
                    }
                    
                    // Validate data types
                    const slotNum = parseInt(slot);
                    const durationNum = parseInt(duration);
                    
                    if (isNaN(slotNum) || isNaN(durationNum)) {
                        console.log(`❌ Invalid numbers in timeslot ${i + 1}:`, { slot, slotNum, duration, durationNum });
                        continue;
                    }
                    
                    timeslotInserts.push([
                        nextId,
                        date,
                        start,
                        durationNum,
                        slotNum
                    ]);
                }

                console.log('Final timeslot inserts prepared:', timeslotInserts);

                if (timeslotInserts.length === 0) {
                    console.log('⚠️ No valid timeslots to insert');
                    req.flash('successP', 'Program created successfully, but no valid timeslots were provided.');
                    return res.redirect('/admin/programs');
                }

                // Insert timeslots one by one with detailed logging
                let completed = 0;
                let hasError = false;
                
                timeslotInserts.forEach((timeslot, index) => {
                    const insertTimeslotQuery = `
                        INSERT INTO Timeslot (ProgramID, Date, Start_Time, Duration, Slots_availablility)
                        VALUES (?, ?, ?, ?, ?)
                    `;
                    
                    console.log(`Inserting timeslot ${index + 1}/${timeslotInserts.length}:`);
                    console.log('Query:', insertTimeslotQuery);
                    console.log('Values:', timeslot);
                    
                    db.query(insertTimeslotQuery, timeslot, (tsErr, tsResult) => {
                        if (tsErr && !hasError) {
                            console.error(`❌ Insert Timeslot ${index + 1} Error:`, tsErr);
                            hasError = true;
                            req.flash('errorP', `Program added, but error saving timeslot ${index + 1}: ${tsErr.message}`);
                            return res.redirect('/admin/programs');
                        }
                        
                        if (!hasError) {
                            console.log(`✅ Timeslot ${index + 1} inserted successfully:`, {
                                insertId: tsResult?.insertId,
                                affectedRows: tsResult?.affectedRows
                            });
                        }
                        
                        completed++;
                        if (completed === timeslotInserts.length && !hasError) {
                            console.log('✅ All timeslots inserted successfully!');
                            req.flash('successP', `Program and ${timeslotInserts.length} timeslot(s) added successfully!`);
                            res.redirect('/admin/programs');
                        }
                    });
                });
            });
        });
    }

    // Handle type selection
    if (typeID === 'other' && other_type && other_type.trim()) {
        console.log('Creating new program type:', other_type.trim());
        db.query(
            'INSERT INTO Program_Type (name) VALUES (?)',
            [other_type.trim()],
            (err, result) => {
                if (err) {
                    console.error('❌ Insert new type error:', err);
                    req.flash('errorP', 'Failed to add new program type.');
                    return res.redirect('/admin/programs');
                }
                console.log('✅ New type created with ID:', result.insertId);
                proceedWithInsert(result.insertId);
            }
        );
    } else {
        console.log('Using existing type ID:', typeID);
        proceedWithInsert(typeID);
    }
    
    console.log('=== ADD PROGRAM DEBUG END ===');
};

// ALSO ADD THIS HELPER FUNCTION FOR TESTING TIMESLOT INSERTION DIRECTLY
exports.testTimeslotInsert = (req, res) => {
    // Test function to manually insert a timeslot
    const testData = [
        'P001', // ProgramID - make sure this exists in your Program table
        '2025-08-01', // Date
        '10:00:00', // Start_Time
        60, // Duration
        10 // Slots_availablility
    ];
    
    const insertQuery = `
        INSERT INTO Timeslot (ProgramID, Date, Start_Time, Duration, Slots_availablility)
        VALUES (?, ?, ?, ?, ?)
    `;
    
    console.log('Testing timeslot insert with data:', testData);
    
    db.query(insertQuery, testData, (err, result) => {
        if (err) {
            console.error('Test insert error:', err);
            return res.json({
                success: false,
                error: err.message,
                errno: err.errno,
                code: err.code
            });
        }
        
        console.log('Test insert successful:', result);
        res.json({
            success: true,
            result: result,
            insertId: result.insertId,
            affectedRows: result.affectedRows
        });
    });
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

    console.log('Edit program received data:', req.body); // Debug log

    if (!title || !typeID || !description || !points_reward || !duration) {
        req.flash('errorP', 'All fields are required');
        return res.redirect(`/programs/edit/${programId}`);
    }

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

            // Extract and process timeslot fields
            const {
                'timeslotID[]': timeslotID = [],
                'timeslot_date[]': timeslot_date = [],
                'timeslot_start[]': timeslot_start = [],
                'timeslot_slots[]': timeslot_slots = []
            } = req.body;

            console.log('Timeslot fields extracted:', {
                timeslotID, timeslot_date, timeslot_start, timeslot_slots
            }); // Debug log

            // Normalize as arrays
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

                    if (tsIDs[i] && tsIDs[i] !== '') {
                        // Update existing timeslot
                        console.log(`Updating timeslot ID ${tsIDs[i]} with:`, { date, start, dur, slots }); // Debug log
                        
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
                                        console.log(`Timeslot ${tsIDs[i]} updated, affected rows:`, result.affectedRows);
                                        resolve();
                                    }
                                }
                            );
                        }));
                    } else {
                        // Insert new timeslot
                        console.log(`Inserting new timeslot:`, { programId, date, start, dur, slots }); // Debug log
                        
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
                                        console.log(`New timeslot inserted with ID:`, result.insertId);
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
                        req.flash('errorP', 'Program updated, but failed to update/add some timeslots: ' + error.message);
                        res.redirect(`/programs/edit/${programId}`);
                    });
            } else {
                req.flash('successP', 'Program updated successfully!');
                res.redirect('/admin/programs');
            }
        });
    }

    if (typeID === 'other' && other_type && other_type.trim()) {
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

exports.debugPrograms = (req, res) => {
    const queries = [
        'SELECT COUNT(*) as program_count FROM Program',
        'SELECT COUNT(*) as timeslot_count FROM Timeslot', 
        'SELECT p.ProgramID, p.Title, COUNT(t.timeslotID) as timeslot_count FROM Program p LEFT JOIN Timeslot t ON p.ProgramID = t.ProgramID GROUP BY p.ProgramID',
        'SELECT * FROM Timeslot ORDER BY ProgramID, Date, Start_Time'
    ];

    let results = {};
    let completed = 0;

    queries.forEach((query, index) => {
        db.query(query, (err, result) => {
            if (err) {
                results[`query_${index}`] = { error: err.message };
            } else {
                results[`query_${index}`] = result;
            }
            completed++;
            
            if (completed === queries.length) {
                res.json({
                    message: 'Debug information',
                    results: results
                });
            }
        });
    });
};