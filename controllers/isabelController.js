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
    const sql = 'SELECT * FROM Reward';
    db.query(sql, (error, results) => {
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
 
// Process reward edit
exports.editReward = (req, res) => {
    const RewardID = req.params.id;
    const { name, description, points, stock } = req.body;
    let sql, params;
 
    if (req.file) {
        // If a new image is uploaded
        const image = req.file.filename;
        sql = 'UPDATE Reward SET name = ?, description = ?, points = ?, stock = ?, image = ? WHERE RewardID = ?';
        params = [name, description, points, stock, image, RewardID];
    } else {
        // No new image uploaded
        sql = 'UPDATE Reward SET name = ?, description = ?, points = ?, stock = ? WHERE RewardID = ?';
        params = [name, description, points, stock, RewardID];
    }
 
    db.query(sql, params, (error, results) => {
        if (error) {
            return res.status(500).send('Error updating reward');
        }
        res.redirect('/admin/rewards');
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
 
// View user's redeemed rewards history
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

        results.reverse();
        res.render('user/redeemHist', { redeems: results });
    });
};