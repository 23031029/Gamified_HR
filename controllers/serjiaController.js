const db = require('../db');
const updateProgramStatus = require('../realtimeUpdates');
const QRCode = require('qrcode');


exports.getSignIn= (req, res)=>{
    res.render('user/index', {
        message: req.flash('successLogin'),
        error: req.flash('errorLogin'),
        currentPath: req.path
    });
};

exports.getRegister = (req, res) => {
  const getDepartments = `SELECT * FROM department`;
  const getLastID = `SELECT staffID FROM staff ORDER BY staffID DESC LIMIT 1`;

  db.query(getDepartments, (err, departments) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).send('Database error');
    }

    db.query(getLastID, (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).send('Database error');
      }

      let nextStaffID = 'S001';
      if (result.length > 0) {
        const lastID = result[0].staffID;
        const num = parseInt(lastID.substring(1)) + 1;
        nextStaffID = 'S' + String(num).padStart(3, '0');
      }

      const regErrors = req.flash('regErrors');
      const regData = req.flash('regData')[0] || {};

      res.render('admin/register', {
        department: departments,
        regData,
        regErrors,
        currentPath: req.path,
        nextStaffID // pass to view
      });
    });
  });
};

exports.login = async (req, res) => {
  const { staffID, password } = req.body;

  // First, check if the staff ID exists
  const findUserSql = `SELECT * FROM staff WHERE staffID = ?`;
  db.query(findUserSql, [staffID], async (err, users) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }

    if (users.length === 0) {
      req.flash('errorLogin', 'User not found');
      return res.redirect('/');
    }

    const user = users[0];

    if (user.status === 'Deactive') {
      req.flash('errorLogin', 'User not found');
      return res.redirect('/');
    }

    // Now check password
    const sql = `SELECT * FROM staff WHERE staffID = ? AND password = SHA1(?) AND status != "Deactive"`;
    db.query(sql, [staffID, password], async (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }

      if (results.length > 0) {
        req.session.staff = results[0];
        req.flash('successLogin', 'Login success');

        try {
          await updateProgramStatus();
        } catch (updateErr) {
          console.error('Error updating program status:', updateErr);
          req.flash('error', 'Failed to update program statuses.');
        }

        if (req.session.staff.role === 'user') {
          return res.redirect('/user/dashboard');
        } else if (req.session.staff.role === 'admin') {
          return res.redirect('/admin/dashboard');
        } else {
          // fallback redirect if role is unexpected
          return res.redirect('/');
        }
      } else {
        req.flash('errorLogin', 'Invalid staff ID or password.');
        return res.redirect('/');
      }
    });
  });
};


exports.register = (req, res) => {
    const { first, last, email, password, role, department, address, phone, dob, gender } = req.body;
    let profile = 'default.jpg';
    if (req.file) {
        profile = req.file.filename;
    }

    const getLatestStaffID = `SELECT staffID FROM staff ORDER BY staffID DESC LIMIT 1`;

    db.query(getLatestStaffID, (err, result) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Error generating Staff ID');
            req.flash('formData', req.body);
            return res.redirect('/admin/register');
        }

        let newStaffID = 'S001';
        if (result.length > 0) {
            const lastID = result[0].staffID;
            const num = parseInt(lastID.substring(1)) + 1;
            newStaffID = 'S' + String(num).padStart(3, '0');
        }

        const checkEmail = `SELECT * FROM staff WHERE email = ?`;

        db.query(checkEmail, [email], (err, emailResult) => {
            if (err) {
                console.error(err);
                req.flash('error', 'Error checking email');
                req.flash('formData', req.body);
                return res.redirect('/admin/register');
            }

            if (emailResult.length > 0) {
                req.flash('error', 'Email address is already registered');
                req.flash('formData', req.body);
                return res.redirect('/admin/register');
            }

            // Updated insert statement to match new database schema
            const insertSql = `INSERT INTO staff 
                (staffID, first_name, last_name, email, password, role, department, home_address, phone_number, dob, date_join, status, total_point, profile_image, gender) 
                VALUES (?, ?, ?, ?, SHA1(?), ?, ?, ?, ?, ?, CURDATE(), 'Active', 0, ?, ?)`;

            db.query(
                insertSql,
                [newStaffID, first, last, email, password, role, department, address, phone, dob, profile, gender],
                (err, result) => {
                    if (err) {
                        console.error(err);
                        req.flash('error', 'Error registering user');
                        req.flash('formData', req.body);
                        return res.redirect('/admin/register');
                    }

                    req.flash('success', 'User registered successfully');
                    res.redirect('/admin/dashboard');
                }
            );
        });
    });
};


exports.logout= (req, res)=>{
    req.session.destroy((err)=>{
        if (err) {
            return res.status(500).send("Failed to log out.");
          }
          res.redirect('/'); 
    })
}

exports.getAdmin = (req, res) => {
    const staffQuery = `SELECT COUNT(*) AS staffCount FROM staff WHERE status= "Active"`;
    const rewardQuery = "SELECT COUNT(*) AS rewardCount FROM reward";
    const programQuery = "SELECT COUNT(*) as programCount FROM program";

    const popular_program = `
        SELECT 
            program.Title as title, 
            ROUND(AVG(pf.Rating), 2) AS average_rating
        FROM 
            program_feedback AS pf
        INNER JOIN 
            program ON program.ProgramID = pf.ProgramID
        GROUP BY 
            program.Title
    `;

    const popular_reward = `
        SELECT 
            reward.name AS name,
            COUNT(redeem.RewardID) AS times_redeemed
        FROM 
            redeem
        INNER JOIN 
            reward ON redeem.RewardID = reward.RewardID
        GROUP BY 
            reward.RewardID, reward.name
        ORDER BY 
            times_redeemed DESC
    `;

    const department_active = `
        SELECT 
            d.name AS department_name,
            COUNT(sp.participantID) AS total_participations
        FROM 
            staff_program sp
        JOIN 
            Staff s ON sp.staffID = s.staffID
        JOIN 
            Department d ON s.department = d.departmentID
        WHERE 
            sp.Status = 'Completed'
            AND MONTH(CURDATE()) = MONTH(CURDATE()) 
            AND YEAR(CURDATE()) = YEAR(CURDATE())
        GROUP BY 
            d.departmentID, d.name
        ORDER BY 
            total_participations DESC
    `;

   const monthly_participant = `
    SELECT 
        DATE_FORMAT(t.Date, '%Y-%m') AS month,
        COUNT(sp.participantID) AS participant_count
    FROM 
        staff_program sp
    JOIN 
        Timeslot t ON sp.timeslotID = t.timeslotID
    WHERE 
        sp.Status = 'Completed'
    GROUP BY 
        DATE_FORMAT(t.Date, '%Y-%m')
    ORDER BY 
        month;
            `;

    const person_details = `
        SELECT 
            staff.*, 
            department.name AS department_name  
        FROM 
            staff 
        INNER JOIN 
            department ON department.departmentID = staff.department
        ORDER BY 
            status ASC, staffID ASC
    `;

    db.query(staffQuery, (err, staffResult) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Error fetching staff count');
            return res.redirect('/admin');
        }

        db.query(rewardQuery, (err, rewardResult) => {
            if (err) {
                console.error(err);
                req.flash('error', 'Error fetching reward count');
                return res.redirect('/admin');
            }

            db.query(programQuery, (err, programResult) => {
                if (err) {
                    console.error(err);
                    req.flash('error', 'Error fetching program count');
                    return res.redirect('/admin');
                }

                const staffCount = staffResult[0].staffCount;
                const programCount = programResult[0].programCount;
                const rewardCount = rewardResult[0].rewardCount;
               

                db.query(popular_program, (err1, result1) => {
                    if (err1) throw err1;

                    const programLabels = result1.map(row => row.title);
                    const programData = result1.map(row => row.average_rating);

                    db.query(popular_reward, (err2, result2) => {
                        if (err2) throw err2;

                        const rewardLabels = result2.map(row => row.name);
                        const rewardData = result2.map(row => row.times_redeemed);

                        db.query(department_active, (err3, result3) => {
                            if (err3) throw err3;

                            const activeLabel = result3.map(row => row.department_name);
                            const activeData = result3.map(row => row.total_participations);

                            db.query(monthly_participant, (err4, result4) => {
                                if (err4) throw err4;

                                const monthLabels = result4.map(row => row.month);
                                const monthData = result4.map(row => row.participant_count);

                                db.query(person_details, (err,result)=>{

                                    if (err) {
                                    console.error('Database error:', err);
                                    return res.status(500).send('Database error');
                                }

                                if (result.length === 0) {
                                    req.flash('errorStaff', 'No staff records found.');
                                }


                                    res.render('admin/dashboard', {
                                    message: req.flash('successStaff'),
                                    error: req.flash('errorStaff'),
                                    currentPath: req.path,
                                    staffCount,
                                    rewardCount,
                                    programCount,
                                    programLabels,
                                    programData,
                                    rewardLabels,
                                    rewardData,
                                    activeLabel,
                                    activeData,
                                    monthLabels,
                                    monthData,
                                    person: result
                                })
                                });
                            });
                        });
                    });
                });
            });
        });
    });
};


exports.updateStatus = (req, res) => {
    const { staffID } = req.params;
    const { status } = req.body;

    const update_Status = "UPDATE staff SET status = ? WHERE staffID = ?";

    db.query(update_Status, [status, staffID], (err, result) => {
        if (err) {
            console.error('Error updating status:', err);
            req.flash('error', 'Failed to update status');
        } else if (result.affectedRows === 0) {
            req.flash('error', 'No staff found with the given ID');
        } else {
            req.flash('success', 'Status updated successfully');
        }
        res.redirect('/admin/dashboard');
    });
};

exports.getEditDetail = (req, res) => {
    const staffID = req.session.staff?.staffID;

    if (!staffID) {
        return res.redirect('/');
    }

    const staffQuery = `
        SELECT staff.*, department.name AS department_name 
        FROM staff
        INNER JOIN department ON department.departmentID = staff.department
        WHERE staff.staffID = ?
    `;

    const ongoingProgramsQuery = `
        SELECT 
            p.Title as title, 
            sp.Status as status,
            t.Date as program_date,
            t.Start_Time as start_time,
            t.Duration as duration
        FROM staff_program sp
        INNER JOIN program p ON sp.programID = p.ProgramID
        INNER JOIN timeslot t ON sp.timeslotID = t.timeslotID
        WHERE sp.staffID = ? AND sp.Status = 'Ongoing'
    `;

    const completedProgramsQuery = `
  SELECT p.Title as title, sp.Status as status
  FROM staff_program sp
  JOIN Program p ON sp.programID = p.ProgramID
  WHERE sp.staffID = ? AND sp.Status = 'Completed'
`;

    db.query(staffQuery, [staffID], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send("Internal Server Error");
        }

        if (results.length === 0) {
            return res.status(404).send("Staff not found");
        }

        const staffData = results[0];

        db.query(ongoingProgramsQuery, [staffID], (err2, ongoingResults) => {
            if (err2) {
                console.error('Database error:', err2);
                return res.status(500).send("Internal Server Error");
            }

            db.query(completedProgramsQuery, [staffID], (err, completedPrograms) => {
                // ...pass completedPrograms to your render
                res.render('user/editDetail', {
                  staff: staffData,
                  completedPrograms,
                  currentPath: req.path
                });
              });
        });
    });
};

exports.getChangePassword = (req, res) => {
    res.render('user/changePassword', {
        error: req.flash('errorChange'),
        success: req.flash('successChange'),
        currentPath: req.path
    });
};

exports.postChangePassword = (req, res) => {
    const staffID = req.session.staff?.staffID;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!staffID) {
        req.flash('errorChange', 'Session expired. Please log in again.');
        return res.redirect('/user/change-password');
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
        req.flash('errorChange', 'All fields are required.');
        return res.redirect('/user/change-password');
    }

    if (newPassword !== confirmPassword) {
        req.flash('errorChange', 'New passwords do not match.');
        return res.redirect('/user/change-password');
    }

    // Check current password
    const checkSql = "SELECT * FROM staff WHERE staffID = ? AND password = SHA1(?)";
    db.query(checkSql, [staffID, currentPassword], (err, results) => {
        if (err) {
            req.flash('errorChange', 'Database error.');
            return res.redirect('/user/change-password');
        }
        if (results.length === 0) {
            req.flash('errorChange', 'Current password is incorrect.');
            return res.redirect('/user/change-password');
        }

        // Update password
        const updateSql = "UPDATE staff SET password = SHA1(?) WHERE staffID = ?";
        db.query(updateSql, [newPassword, staffID], (err2) => {
            if (err2) {
                req.flash('errorChange', 'Failed to update password.');
                return res.redirect('/user/change-password');
            }
            req.flash('successChange', 'Password updated successfully.');
            res.redirect('/user/profile');
        });
    });
};

exports.editStaff = (req, res) => {
    const staffID = req.params.staffID;
    const {
        first_name,
        last_name,
        role,
        department_name,
        old_profile_image
    } = req.body;

    const getDeptID = `SELECT departmentID FROM department WHERE name = ?`;

    let profile_image = old_profile_image;
    if (req.file && req.file.filename) {
        profile_image = req.file.filename;
    }
    
    db.query(getDeptID, [department_name], (err, deptResult) => {
        if (err || deptResult.length === 0) {
            req.flash('errorStaff', 'Invalid department');
            return res.redirect('/admin/dashboard');
        }
        const departmentID = deptResult[0].departmentID;

        const updateSql = `
            UPDATE staff
            SET first_name = ?, last_name = ?, role = ?, department = ?, profile_image = ?
            WHERE staffID = ?
        `;
        db.query(updateSql, [first_name, last_name, role, departmentID, profile_image, staffID], (err2) => {
            if (err2) {
                req.flash('errorStaff', 'Failed to update staff details');
            } else {
                req.flash('successStaff', 'Staff details updated successfully');
            }
            res.redirect('/admin/dashboard');
        });
    });
};

exports.getEditStaff = (req, res) => {
    const staffID = req.params.staffID;

    // Get staff details and all departments for dropdown
    const staffQuery = `
        SELECT staff.*, department.name AS department_name
        FROM staff
        INNER JOIN department ON department.departmentID = staff.department
        WHERE staff.staffID = ?
    `;
    const deptQuery = `SELECT * FROM department`;

    db.query(staffQuery, [staffID], (err, staffResults) => {
        if (err || staffResults.length === 0) {
            req.flash('errorStaff', 'Staff not found');
            return res.redirect('/admin/dashboard');
        }
        db.query(deptQuery, (err2, deptResults) => {
            if (err2) {
                req.flash('errorStaff', 'Failed to load departments');
                return res.redirect('/admin/dashboard');
            }
            res.render('admin/editStaff', {
                staff: staffResults[0],
                departments: deptResults,
                error: req.flash('errorStaff'),
                success: req.flash('successStaff'),
                currentPath: req.path
            });
        });
    });
};

// POST: Update staff details (name, role, department, profile image, add new department if needed)
exports.postEditStaff = (req, res) => {
    const staffID = req.params.staffID;
    const { first_name, last_name, role, department, other_department, old_profile_image } = req.body;

    // Handle profile image
    let profile_image = old_profile_image;
    if (req.file && req.file.filename) {
        profile_image = req.file.filename;
    }

    // If "other" is selected, add new department and use its ID
    if (department === 'other' && other_department && other_department.trim() !== '') {
        // Generate new departmentID (e.g., D005)
        const getLastDeptID = `SELECT departmentID FROM department ORDER BY departmentID DESC LIMIT 1`;
        db.query(getLastDeptID, (err, deptResults) => {
            if (err) {
                req.flash('errorStaff', 'Failed to add new department');
                return res.redirect(`/editStaff/${staffID}`);
            }
            let newDeptNum = 1;
            if (deptResults.length > 0) {
                newDeptNum = parseInt(deptResults[0].departmentID.substring(1)) + 1;
            }
            const newDeptID = 'D' + String(newDeptNum).padStart(3, '0');
            const insertDept = `INSERT INTO department (departmentID, name) VALUES (?, ?)`;
            db.query(insertDept, [newDeptID, other_department.trim()], (err2) => {
                if (err2) {
                    req.flash('errorStaff', 'Failed to add new department');
                    return res.redirect(`/editStaff/${staffID}`);
                }
                // Now update staff with new departmentID
                updateStaff(newDeptID);
            });
        });
    } else {
        // Use selected department
        updateStaff(department);
    }

    function updateStaff(departmentID) {
        const updateSql = `
            UPDATE staff
            SET first_name = ?, last_name = ?, role = ?, department = ?, profile_image = ?
            WHERE staffID = ?
        `;
        db.query(updateSql, [first_name, last_name, role, departmentID, profile_image, staffID], (err2) => {
            if (err2) {
                req.flash('errorStaff', 'Failed to update staff details');
                return res.redirect(`/editStaff/${staffID}`);
            }
            req.flash('successStaff', 'Staff details updated successfully');
            res.redirect('/admin/dashboard');
        });
    }
};


exports.editParticulars = (req, res) => {
    const staffID = req.session.staff?.staffID;
    const { field, value } = req.body;
    const allowedFields = ['email', 'phone_number', 'home_address'];

    if (!staffID || !allowedFields.includes(field)) {
        req.flash('error', 'Invalid request.');
        return res.redirect('/user/profile');
    }

    const sql = `UPDATE staff SET ${field} = ? WHERE staffID = ?`;
    db.query(sql, [value, staffID], (err, result) => {
        if (err) {
            req.flash('error', 'Failed to update details.');
            return res.redirect('/user/profile');
        }
        req.session.staff[field] = value;
        req.flash('success', 'Details updated successfully.');
        res.redirect('/user/profile');
    });
};

exports.getGenerateQR = (req, res) => {
  const todayProgramsQuery = `
    SELECT t.timeslotID, p.Title, t.Date, t.Start_Time 
    FROM Timeslot t 
    JOIN Program p ON t.ProgramID = p.ProgramID 
  `;

  db.query(todayProgramsQuery, async (err, timeslots) => {
    if (err) {
      console.error('Error fetching today programs:', err);
      return res.status(500).send('DB Error');
    }

    const staffID = req.session.staff?.staffID || 'S001';

    const qrPromises = timeslots.map(ts => {
      const url = `http://localhost:3000/user/attend?staffID=${staffID}&timeslotID=${ts.timeslotID}`;
      return QRCode.toDataURL(url).then(qr => ({ ...ts, qr }));
    });

    const qrTimeslots = await Promise.all(qrPromises);

    res.render('admin/generate', {
      qrTimeslots,
      currentPath: req.path
    });
  });
};

exports.getScanQR = (req, res) => {
  res.render('user/scan', {
    currentPath: req.path
  });
};


exports.markAttendance = (req, res) => {
  const { staffID, timeslotID } = req.query;

  if (!staffID || !timeslotID) {
    return res.status(400).send("Invalid QR parameters.");
  }

  const query = `
    UPDATE staff_program 
    SET Status = 'Completed' 
    WHERE staffID = ? AND timeslotID = ?
  `;

  db.query(query, [staffID, timeslotID], (err, result) => {
    if (err) {
      console.error('Attendance error:', err);
      return res.status(500).send("Database error.");
    }

    if (result.affectedRows > 0) {
      res.send("✅ Attendance marked successfully!");
    } else {
      res.send("⚠️ Attendance not recorded. Maybe already completed or not registered.");
    }
  });
};

