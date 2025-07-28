const db = require('../db');
 
// View all rewards (admin)
exports.viewRewards = (req, res) => {
    const sql = 'SELECT * FROM Reward';
    db.query(sql, (error, results) => {
        if (error) {
            return res.status(500).send('Error retrieving rewards');
        }
        if (results.length > 0) {
            res.render('admin/viewRewards', { rewards: results, currentPath: req.path});
        } else {
            res.status(404).send('No rewards found');
        }
    });
};
 
// user view rewards
exports.userRewards = (req, res) => {
    const staffID = req.session.staff?.staffID;
    const sql = `SELECT *
            FROM Reward
            ORDER BY
            points <= (
                SELECT total_point
                FROM Staff
                WHERE staffID = ?
            ) DESC,
            points ASC;
            `;
    db.query(sql,[staffID], (error, results) => {
        if (error) {
            return res.status(500).send('Error retrieving rewards');
        }
        res.render('user/userRewards', {
            rewards: results,
            messageR: {
                success: req.flash('success'),
                error: req.flash('error')
            },
            currentPath: req.path
        });
    });
};
 
exports.readReward = (req, res) => {
    const RewardID = req.params.id;
    const sql = 'SELECT * FROM Reward WHERE RewardID = ?';
    db.query(sql, [RewardID], (error, results) => {
        if (error) {
            return res.status(500).send('Error retrieving reward');
        }
        if (results.length > 0) {
            res.render('user/readRewards', { reward: results[0], currentPath: req.path });
        } else {
            req.flash('error', 'Reward not found');
            res.redirect('/user/rewards');
        }
    });
};
 
 
// Show add reward form
exports.addRewardForm = (req, res) => {
    res.render('admin/addRewards', {currentPath: req.path});
};
 
// Handle reward addition
exports.addReward = (req, res) => {
    let { name, description, points, stock } = req.body;
    let image = null;
 
    if (req.file) {
        image = req.file.filename;
    }
 
    // Get the current max RewardID and generate next one
    const getMaxIdSQL = "SELECT RewardID FROM Reward ORDER BY RewardID DESC LIMIT 1";
    db.query(getMaxIdSQL, (err, results) => {
        if (err) {
            return res.status(500).send('Error fetching RewardID');
        }
 
        let newId;
        if (results.length > 0) {
            const lastId = results[0].RewardID; // e.g., "R004"
            const numericPart = parseInt(lastId.substring(1)) + 1;
            newId = "R" + numericPart.toString().padStart(3, '0'); // R005
        } else {
            newId = "R001"; // First reward
        }
 
        const insertSQL = 'INSERT INTO Reward (RewardID, name, description, points, stock, image) VALUES (?, ?, ?, ?, ?, ?)';
        db.query(insertSQL, [newId, name, description, points, stock, image], (error, results) => {
            if (error) {
                console.error("Database Error:", error);
                return res.status(500).send('Error adding reward');
            }
            res.redirect('/admin/rewards');
        });
    });
};
 
 
 
// Edit reward form
exports.editRewardForm = (req, res) => {
    const RewardID = req.params.id;
    const sql = 'SELECT * FROM Reward WHERE RewardID = ?';
    db.query(sql, [RewardID], (error, results) => {
        if (error) {
            return res.status(500).send('Error retrieving reward');
        }
        if (results.length > 0) {
            res.render('admin/editRewards', { reward: results[0] , currentPath: req.path});
        } else {
            res.status(404).send('Reward not found');
        }
    });
};
 
// Process program edit
exports.postEditProgram = (req, res) => {
  const programId = req.params.id;
  const { title, type, description, points_reward } = req.body;

  if (!title || !type || !description || !points_reward) {
    req.flash('errorP', 'All fields are required.');
    return res.redirect(`/programs/edit/${programId}`);
  }

  const sql = 'UPDATE Program SET Title = ?, Type = ?, Description = ?, points_reward = ? WHERE ProgramID = ?';
  const params = [title, type, description, points_reward, programId];

  db.query(sql, params, (err, result) => {
    if (err) {
      console.error('Error updating program:', err);
      req.flash('errorP', 'Failed to update program.');
      return res.redirect(`/programs/edit/${programId}`);
    }

    const {
      timeslotID = [],
      timeslot_date = [],
      timeslot_start = [],
      timeslot_duration = [],
      timeslot_slots = []
    } = req.body;

    const tsIDs = Array.isArray(timeslotID) ? timeslotID : [timeslotID];
    const tsDates = Array.isArray(timeslot_date) ? timeslot_date : [timeslot_date];
    const tsStarts = Array.isArray(timeslot_start) ? timeslot_start : [timeslot_start];
    const tsDurations = Array.isArray(timeslot_duration) ? timeslot_duration : [timeslot_duration];
    const tsSlots = Array.isArray(timeslot_slots) ? timeslot_slots : [timeslot_slots];

    let i = 0;

    function processNextTimeslot() {
      if (i >= tsDates.length) {
        req.flash('successP', 'Program and timeslots updated successfully!');
        return res.redirect('/admin/programs');
      }

      if (tsDates[i] && tsStarts[i] && tsDurations[i] && tsSlots[i]) {
        const date = tsDates[i];
        const start = tsStarts[i];
        const duration = parseInt(tsDurations[i]);
        const slots = parseInt(tsSlots[i]);

        if (tsIDs[i]) {
          const updateTsSql = `
            UPDATE Timeslot 
            SET Date = ?, Start_Time = ?, Duration = ?, Slots_availablility = ?
            WHERE timeslotID = ?
          `;
          const updateTsParams = [date, start, duration, slots, tsIDs[i]];

          db.query(updateTsSql, updateTsParams, (err) => {
            if (err) {
              console.error('Error updating timeslot:', err);
              req.flash('errorP', 'Program updated, but failed to update some timeslots.');
              return res.redirect(`/programs/edit/${programId}`);
            }
            i++;
            processNextTimeslot();
          });
        } else {
          const insertTsSql = `
            INSERT INTO Timeslot (ProgramID, Date, Start_Time, Duration, Slots_availablility)
            VALUES (?, ?, ?, ?, ?)
          `;
          const insertTsParams = [programId, date, start, duration, slots];

          db.query(insertTsSql, insertTsParams, (err) => {
            if (err) {
              console.error('Error inserting timeslot:', err);
              req.flash('errorP', 'Program updated, but failed to add some new timeslots.');
              return res.redirect(`/programs/edit/${programId}`);
            }
            i++;
            processNextTimeslot();
          });
        }
      } else {
        i++;
        processNextTimeslot();
      }
    }

    processNextTimeslot();
  });
};

exports.updateReward = (req, res) => {
  const RewardID = req.params.id;
  const { name, description, points, stock } = req.body;
  let image = req.file ? req.file.filename : null;

  const getImageSQL = 'SELECT image FROM Reward WHERE RewardID = ?';

  db.query(getImageSQL, [RewardID], (err, result) => {
    if (err || result.length === 0) {
      req.flash('error', 'Reward not found.');
      return res.redirect('/admin/rewards');
    }

    const currentImage = result[0].image;
    const finalImage = image || currentImage;

    const updateSQL = `
      UPDATE Reward 
      SET name = ?, description = ?, points = ?, stock = ?, image = ?
      WHERE RewardID = ?
    `;

    db.query(updateSQL, [name, description, points, stock, finalImage, RewardID], (err2) => {
      if (err2) {
        console.error('Error updating reward:', err2);
        req.flash('error', 'Failed to update reward.');
        return res.redirect('/admin/rewards');
      }

      req.flash('success', 'Reward updated successfully!');
      res.redirect('/admin/rewards');
    });
  });
};


// View a single reward's detail page
exports.viewSingleReward = (req, res) => {
    const RewardID = req.params.id;
 
    // Use correct table and column names
    db.query('SELECT * FROM Reward WHERE RewardID = ?', [RewardID], (err, results) => {
        if (err || results.length === 0) {
            req.flash('error', 'Reward not found.');
            return res.redirect('/user/rewards');
        }
 
        res.render('user/readRewards', {
            reward: results[0],
            messageR: {
                success: req.flash('success'),
                error: req.flash('error')
            },
            currentPath: req.path
        });
    });
};
 
// Claim a reward and decrease its stock
exports.claimReward = (req, res) => {
    const RewardID = req.params.id;
    const staffID = req.session.staff?.staffID;
 
    if (!staffID) {
        req.flash('error', 'Session expired. Please log in again.');
        return res.redirect('/user/rewards');
    }
 
    const checkStockQuery = 'SELECT stock, points FROM Reward WHERE RewardID = ?';
    const getStaffPointsQuery = 'SELECT total_point FROM Staff WHERE staffID = ?';
    const updateStockQuery = 'UPDATE Reward SET stock = stock - 1 WHERE RewardID = ?';
    const insertRedeemQuery = 'INSERT INTO Redeem (staffID, RewardID, Redeem_Date) VALUES (?, ?, NOW())';
    const updatePointsQuery = 'UPDATE Staff SET total_point = total_point - ? WHERE staffID = ?';
 
    db.query(checkStockQuery, [RewardID], (err, rewardResults) => {
        if (err) {
            console.error('Error checking stock:', err);
            req.flash('error', 'Database error.');
            return res.redirect('/user/rewards');
        }
 
        if (rewardResults.length === 0) {
            req.flash('error', 'Reward not found.');
            return res.redirect('/user/rewards');
        }
 
        const stock = rewardResults[0].stock;
        const pointsRequired = rewardResults[0].points;
 
        if (stock <= 0) {
            req.flash('error', 'Reward is out of stock.');
            return res.redirect('/user/rewards');
        }
 
        // Check staff's points
        db.query(getStaffPointsQuery, [staffID], (staffErr, staffResults) => {
            if (staffErr) {
                console.error('Error checking staff points:', staffErr);
                req.flash('error', 'Database error.');
                return res.redirect('/user/rewards');
            }
 
            if (staffResults.length === 0) {
                req.flash('error', 'Staff not found.');
                return res.redirect('/user/rewards');
            }
 
            const staffPoints = staffResults[0].total_point;
 
            if (staffPoints < pointsRequired) {
                req.flash('error', 'Insufficient points to collect this reward.');
                return res.redirect('/user/rewards');
            }
 
            // Proceed to claim reward
            db.query(updateStockQuery, [RewardID], (updateErr) => {
                if (updateErr) {
                    console.error('Error updating stock:', updateErr);
                    req.flash('error', 'Failed to claim reward.');
                    return res.redirect('/user/rewards');
                }
                db.query(insertRedeemQuery, [staffID, RewardID], (redeemErr) => {
                    if (redeemErr) {
                        console.error('Error inserting redeem record:', redeemErr);
                        req.flash('error', 'Failed to record redemption.');
                        return res.redirect('/user/rewards');
                    }
                    db.query(updatePointsQuery, [pointsRequired, staffID], (pointsErr) => {
                        if (pointsErr) {
                            console.error('Error updating points:', pointsErr);
                            req.flash('error', 'Failed to deduct points.');
                            return res.redirect('/user/rewards');
                        }
                        req.flash(
                            'success',
                            'Reward claimed successfully! <a href="/user/redeemHist">Click here</a> to view your rewards claimed history.'
                        );
                        return res.redirect('/user/rewards');
                    });
                });
            });
        });
    });
};

exports.redeemHistory = (req, res) => {
    const staffID = req.session.staff?.staffID;
    if (!staffID) {
        req.flash('error', 'Session expired. Please log in again.');
        return res.redirect('/user/rewards');
    }
    const sql = `
      SELECT r.name, r.points, rd.Redeem_Date
      FROM Redeem rd
      JOIN Reward r ON rd.RewardID = r.RewardID
      WHERE rd.staffID = ?
      ORDER BY rd.Redeem_Date DESC
    `;
    db.query(sql, [staffID], (err, results) => {
        if (err) {
            req.flash('error', 'Error retrieving redeem history.');
            return res.redirect('/user/rewards');
        }
        res.render('user/redeemHist', { redeems: results });
    });
};