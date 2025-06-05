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
            messages: {
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
            messages: {
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

    // Use correct table and column names
    const checkStockQuery = 'SELECT stock FROM Reward WHERE RewardID = ?';
    const updateStockQuery = 'UPDATE Reward SET stock = stock - 1 WHERE RewardID = ?';

    db.query(checkStockQuery, [RewardID], (err, results) => {
        if (err) {
            console.error('Error checking stock:', err);
            req.flash('error', 'Database error.');
            return res.redirect('/user/rewards');
        }

        if (results.length === 0) {
            req.flash('error', 'Reward not found.');
            return res.redirect('/user/rewards');
        }

        const stock = results[0].stock;
        if (stock > 0) {
            db.query(updateStockQuery, [RewardID], (updateErr) => {
                if (updateErr) {
                    console.error('Error updating stock:', updateErr);
                    req.flash('error', 'Failed to claim reward.');
                } else {
                    req.flash('success', 'Reward claimed successfully!');
                }
                return res.redirect('/user/rewards');
            });
        } else {
            req.flash('error', 'Reward is out of stock.');
            return res.redirect('/user/rewards');
        }
    });
};
