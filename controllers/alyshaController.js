const db = require('../db');

// Admin - List all programs
exports.getProgramsAdmin = (req, res) => {
    const query = `
        SELECT 
            program.*,
            concat(staff.first_name, " ",staff.last_name) as name
        FROM Program 
        inner Join staff ON staff.staffID= program.created_by
        ORDER BY Start_Date ASC
    `;

    db.query(query, (err, programs) => {
        if (err) {
            console.error('Error retrieving programs:', err.messageP);
            return res.status(500).send('Server error');
        }

        const successMessage = req.flash('successP');
        const errorMessage = req.flash('errorP');

        res.render('admin/programsAdmin', { 
            programs, 
            error: err, 
            messageP: successMessage.length > 0 ? successMessage[0] : (errorMessage.length > 0 ? errorMessage[0] : null),
            messageType: successMessage.length > 0 ? 'success' : (errorMessage.length > 0 ? 'error' : null),
            currentPath: req.path
        });
    });
};

// User - List all programs
exports.getProgramsUser = (req, res) => {
    const query = `
        SELECT 
            ProgramID, Title, Description, Type, Start_Date, End_Date,
            start_time, end_time, Created_By, points_reward, QR_code
        FROM Program 
        ORDER BY Start_Date ASC
    `;

    db.query(query, (err, programs) => {
        if (err) {
            console.error('Error retrieving programs:', err.messageP);
            return res.status(500).send('Server error');
        }

        res.render('user/programsUser', { 
            programs, 
            error: err, 
            messageP: req.flash('successP'),
            currentPath: req.path
        });
    });
};

// Public view
// exports.showProgramsPage = (req, res) => {
//     const query = `
//         SELECT 
//             ProgramID, Title, Description, Type, Start_Date, End_Date,
//             start_time, end_time, Created_By, points_reward, QR_code
//         FROM Program 
//         ORDER BY Start_Date DESC
//     `;

//     db.query(query, (err, programs) => {
//         if (err) {
//             console.error('Error fetching programs:', err);
//             return res.status(500).render('error', { message: 'Failed to load programs' });
//         }

//         res.render('programs', { programs });
//     });
// };

// API endpoint
exports.getProgramsAPI = (req, res) => {
    const query = `
        SELECT 
            ProgramID, Title, Description, Type, Start_Date, End_Date,
            start_time, end_time, Created_By, points_reward, QR_code
        FROM Program 
        ORDER BY Start_Date DESC
    `;

    db.query(query, (err, programs) => {
        if (err) {
            console.error('Error fetching programs:', err);
            return res.status(500).json({ error: 'Failed to load programs' });
        }

        res.json(programs);
    });
};

// Delete a program
exports.deleteProgram = (req, res) => {
    const programID = req.params.id;

    if (!programID) {
        return res.status(400).json({ successP: false, messageP: 'Program ID is required' });
    }

    const checkQuery = 'SELECT Title FROM Program WHERE ProgramID = ?';

    db.query(checkQuery, [programID], (err, results) => {
        if (err) {
            console.error('Error checking program:', err.message);
            return res.status(500).json({ success: false, messageP: 'Server error while checking program' });
        }

        if (results.length === 0) {
            return res.status(404).json({ success: false, messageP: 'Program not found' });
        }

        // Before deleting the program
        const deleteRelated = 'DELETE FROM staff_program WHERE ProgramID = ?';
        db.query(deleteRelated, [programID], (relErr) => {
            if (relErr) {
                console.error('Error deleting related records:', relErr.message);
                return res.status(500).json({ success: false, messageP: 'Failed to delete related records' });
            }

            const deleteQuery = 'DELETE FROM Program WHERE ProgramID = ?';

            db.query(deleteQuery, [programID], (deleteErr) => {
                if (deleteErr) {
                    console.error('Error deleting program:', deleteErr.message);
                    return res.status(500).json({ success: false, messageP: 'Failed to delete program' });
                }

                console.log(`Program ${programID} deleted successfully`);
                return res.redirect(`/admin/programs`);
            });
        });
    });
};

// Render add program form
exports.getAddProgram = (req, res) => {
    const query = `SELECT ProgramID FROM Program ORDER BY ProgramID DESC LIMIT 1`;

    db.query(query, (err, result) => {
        if (err) {
            console.error('Error fetching last ProgramID:', err.messageP);
            return res.status(500).send('Error loading form');
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

// Handle POST add program
exports.postAddProgram = (req, res) => {
    const {
        title, description, type,
        start_date, end_date, start_time, end_time,
        points_reward, staffID, avaliable_slots // <-- add this
    } = req.body;

    let QR_code = null;

    if (req.file) {
        QR_code = req.file.filename;
    }

    const getLastIdQuery = `SELECT ProgramID FROM Program ORDER BY ProgramID DESC LIMIT 1`;

    db.query(getLastIdQuery, (err, result) => {
        if (err) {
            console.error('Error fetching last ProgramID:', err.messageP);
            return res.status(500).send('Error saving program');
        }

        let nextId = 'P001';
        if (result.length > 0) {
            const lastId = result[0].ProgramID;
            const numericPart = parseInt(lastId.slice(1)) + 1;
            nextId = 'P' + numericPart.toString().padStart(3, '0');
        }

        const insertQuery = `
            INSERT INTO Program 
            (ProgramID, Title, Description, Type, Start_Date, End_Date, start_time, end_time, points_reward, avaliable_slots, QR_code, created_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            nextId,
            title,
            description,
            type,
            start_date,
            end_date,
            start_time,
            end_time,
            points_reward,
            avaliable_slots, // <-- add this
            QR_code,
            staffID
        ];

        db.query(insertQuery, values, (insertErr) => {
            if (insertErr) {
                console.error('Error inserting program:', insertErr.messageP);
                return res.status(500).send('Error saving program');
            }

            req.flash('successP', 'Program added successfully!');
            res.redirect('/admin/programs');
        });
    });
};

// Render edit form
exports.getEditProgram = (req, res) => {
    const programID = req.params.id;
    const query = `SELECT * FROM Program WHERE ProgramID = ?`;

    db.query(query, [programID], (err, results) => {
        if (err) {
            console.error('Error fetching program:', err.messageP);
            return res.status(500).send('Error retrieving program');
        }

        if (results.length === 0) {
            return res.status(404).send('Program not found');
        }

        res.render('admin/editPrograms', {
            program: results[0],
            messageP: req.flash('successP')[0] || req.flash('error')[0] || null,
            messageType: req.flash('errorP').length > 0 ? 'error' : (req.flash('successP').length > 0 ? 'successP' : null),
            currentPath: req.path
        });
    });
};

// Handle POST edit program
exports.postEditProgram = (req, res) => {
    const programId = req.params.id;
    const { title, type, description, startDate, endDate, pointsReward } = req.body;

    if (!title || !type || !description || !startDate || !endDate || !pointsReward) {
        req.flash('error', 'All fields are required');
        return res.redirect(`/programs/edit/${programId}`);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end <= start) {
        req.flash('error', 'End date must be after start date');
        return res.redirect(`/programs/edit/${programId}`);
    }

    const points = parseInt(pointsReward);
    if (points < 1 || points > 1000) {
        req.flash('error', 'Points reward must be between 1 and 1000');
        return res.redirect(`/programs/edit/${programId}`);
    }

    const updateQuery = `
        UPDATE Program 
        SET Title = ?, Type = ?, Description = ?, 
            Start_Date = ?, End_Date = ?, points_reward = ?
        WHERE ProgramID = ?
    `;

    const values = [title, type, description, startDate, endDate, points, programId];

    db.query(updateQuery, values, (err, result) => {
        if (err) {
            console.error('Error updating program:', err.messageP);
            req.flash('error', 'Failed to update program. Please try again.');
            return res.redirect(`/programs/edit/${programId}`);
        }

        if (result.affectedRows === 0) {
            req.flash('error', 'Program not found or no changes made');
            return res.redirect(`/programs/edit/${programId}`);
        }

        req.flash('successP', 'Program updated successfully!');
        res.redirect('/admin/programs');
    });
};

exports.joinProgram = (req, res) => {
    const { programID, slotDate, slotTime } = req.body;
    const userID = req.session.staff.staffID;

    if (!programID || !slotDate || !slotTime || !userID) {
        return res.json({ success: false, message: "Missing required data." });
    }

    const checkQuery = `SELECT * FROM program_booking WHERE staffID = ? AND ProgramID = ?`;
    db.query(checkQuery, [userID, programID], (checkErr, results) => {
        if (checkErr) return res.json({ success: false, message: "Database error." });

        if (results.length > 0) {
            return res.json({ success: false, message: "Already booked this program." });
        }

        const insertQuery = `
            INSERT INTO program_booking (ProgramID, staffID, slot_date, slot_time)
            VALUES (?, ?, ?, ?)
        `;

        db.query(insertQuery, [programID, userID, slotDate, slotTime], (insertErr) => {
            if (insertErr) return res.json({ success: false, message: "Failed to book slot." });

            // Award points
            const getPointsQuery = `SELECT points_reward FROM Program WHERE ProgramID = ?`;
            db.query(getPointsQuery, [programID], (err, result) => {
                if (err || result.length === 0) return res.json({ success: true, message: "Booked, but failed to add points." });

                const pointsToAdd = result[0].points_reward;
                const updatePoints = `
                    INSERT INTO points (staffID, earned, spent, balance)
                    VALUES (?, ?, 0, ?)
                    ON DUPLICATE KEY UPDATE 
                    earned = earned + ?, balance = balance + ?
                `;

                db.query(updatePoints, [userID, pointsToAdd, pointsToAdd, pointsToAdd, pointsToAdd], (err2) => {
                    if (err2) return res.json({ success: true, message: "Slot booked. Error updating points." });

                    return res.json({ success: true, message: "Slot booked and points awarded!" });
                });
            });
        });
    });
};
