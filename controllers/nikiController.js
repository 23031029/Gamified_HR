const db = require('../db');

// =========================
// USER DASHBOARD
// =========================
exports.getUserDashboard = (req, res) => {
  const staffID = req.session.staff.staffID;

  const userInfoQuery = `
    SELECT s.*, d.name AS department_name 
    FROM Staff s 
    JOIN Department d ON s.department = d.departmentID 
    WHERE s.staffID = ?
  `;

  const ongoingProgramsQuery = `
    SELECT sp.*, p.Start_Date, p.End_Date 
    FROM staff_program sp 
    JOIN Program p ON sp.programID = p.ProgramID 
    WHERE sp.staffID = ? AND sp.Status != 'Completed'
  `;

  const redeemedRewardsQuery = `
    SELECT r.name, r.description, re.Redeem_Date, r.points 
    FROM Redeem re 
    JOIN Reward r ON re.RewardID = r.RewardID 
    WHERE re.staffID = ?
  `;

  const totalEarnedQuery = `SELECT SUM(points_earned) AS total_earned FROM staff_program WHERE staffID = ?`;
  const totalSpentQuery = `
    SELECT SUM(r.points) AS total_spent 
    FROM Redeem re 
    JOIN Reward r ON re.RewardID = r.RewardID 
    WHERE re.staffID = ?
  `;

  db.query(userInfoQuery, [staffID], (err, userResults) => {
    if (err) return res.status(500).send("Error fetching user info");

    const user = userResults[0];

    db.query(ongoingProgramsQuery, [staffID], (err, programResults) => {
      if (err) return res.status(500).send("Error fetching programs");

      db.query(redeemedRewardsQuery, [staffID], (err, rewardResults) => {
        if (err) return res.status(500).send("Error fetching rewards");

        db.query(totalEarnedQuery, [staffID], (err, earnedResult) => {
          if (err) return res.status(500).send("Error fetching points earned");

          db.query(totalSpentQuery, [staffID], (err, spentResult) => {
            if (err) return res.status(500).send("Error fetching points spent");

            res.render('user/dashboard', {
              user,
              programs: programResults,
              rewards: rewardResults,
              points: {
                earned: earnedResult[0].total_earned || 0,
                spent: spentResult[0].total_spent || 0,
                balance: user.total_point || 0
              }
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
  const filter = req.query.filter || 'all';
  const currentDept = req.session.staff.department;

  let sql = `
    SELECT s.staffID, s.name, s.total_point, s.profile_image, d.name AS department_name
    FROM Staff s
    JOIN Department d ON s.department = d.departmentID
    WHERE s.role = 'user'
  `;

  const params = [];

  if (filter === 'department') {
    sql += ` AND s.department = ?`;
    params.push(currentDept);
  }

  sql += ` ORDER BY s.total_point DESC`;

  db.query(sql, params, (err, leaderboardResults) => {
    if (err) return res.status(500).send("Error fetching leaderboard");

    const historySQL = `
      SELECT lh.*, s.name, d.name AS department_name
      FROM leaderboard_history lh
      JOIN staff s ON lh.staffID = s.staffID
      JOIN department d ON s.department = d.departmentID
      ORDER BY lh.year DESC, lh.half DESC, lh.rank_position ASC
    `;

    db.query(historySQL, (err, historyResults) => {
      if (err) return res.status(500).send("Error fetching leaderboard history");

      res.render('user/leaderboard', {
        leaderboard: leaderboardResults,
        filter,
        history: historyResults
      });
    });
  });
};

// =========================
// ADMIN LEADERBOARD
// =========================
exports.getAdminLeaderboard = (req, res) => {
  const filter = req.query.filter || 'all';
  const currentDept = req.session.staff.department;

  let sql = `
    SELECT s.staffID, s.name, s.total_point, s.profile_image, d.name AS department_name
    FROM Staff s
    JOIN Department d ON s.department = d.departmentID
    WHERE s.role = 'user'
  `;

  const params = [];

  if (filter === 'department') {
    sql += ` AND s.department = ?`;
    params.push(currentDept);
  }

  sql += ` ORDER BY s.total_point DESC`;

  db.query(sql, params, (err, leaderboardResults) => {
    if (err) return res.status(500).send("Error fetching leaderboard");

    const historySQL = `
      SELECT lh.*, s.name, d.name AS department_name
      FROM leaderboard_history lh
      JOIN staff s ON lh.staffID = s.staffID
      JOIN department d ON s.department = d.departmentID
      ORDER BY lh.year DESC, lh.half DESC, lh.rank_position ASC
    `;

    db.query(historySQL, (err, historyResults) => {
      if (err) return res.status(500).send("Error fetching leaderboard history");

      res.render('admin/leaderboard', {
        leaderboard: leaderboardResults,
        filter,
        history: historyResults
      });
    });
  });
};

// =========================
// ADMIN DASHBOARD
// =========================
exports.getAdminDashboard = (req, res) => {
  const adminID = req.session.staff.staffID;

  const profileQuery = `
    SELECT s.*, d.name AS department_name
    FROM Staff s
    JOIN Department d ON s.department = d.departmentID
    WHERE s.staffID = ?
  `;

  const statsQuery = {
    users: `SELECT COUNT(*) AS total_users FROM Staff WHERE role = 'user'`,
    programs: `SELECT COUNT(*) AS total_programs FROM Program`,
    redemptions: `SELECT COUNT(*) AS total_redemptions FROM Redeem`
  };

  const recentProgramsQuery = `
    SELECT Title, Type, End_Date
    FROM Program
    WHERE Created_By = ?
    ORDER BY End_Date DESC
    LIMIT 3
  `;

  const recentRedemptionsQuery = `
    SELECT s.name, r.name AS reward_name, re.Redeem_Date
    FROM Redeem re
    JOIN Reward r ON re.RewardID = r.RewardID
    JOIN Staff s ON re.staffID = s.staffID
    ORDER BY re.Redeem_Date DESC
    LIMIT 5
  `;

  const ongoingProgramsQuery = `
    SELECT sp.*, p.Start_Date, p.End_Date 
    FROM staff_program sp 
    JOIN Program p ON sp.programID = p.ProgramID 
    WHERE sp.staffID = ? AND sp.Status != 'Completed'
  `;

  const redeemedRewardsQuery = `
    SELECT r.name, r.description, re.Redeem_Date, r.points 
    FROM Redeem re 
    JOIN Reward r ON re.RewardID = r.RewardID 
    WHERE re.staffID = ?
  `;

  const totalEarnedQuery = `SELECT SUM(points_earned) AS total_earned FROM staff_program WHERE staffID = ?`;
  const totalSpentQuery = `
    SELECT SUM(r.points) AS total_spent 
    FROM Redeem re 
    JOIN Reward r ON re.RewardID = r.RewardID 
    WHERE re.staffID = ?
  `;

  db.query(profileQuery, [adminID], (err, profileResult) => {
    if (err) return res.status(500).send("Error loading admin profile");
    const admin = profileResult[0];

    db.query(statsQuery.users, (err, userResult) => {
      if (err) return res.status(500).send("Error fetching user count");
      db.query(statsQuery.programs, (err, programResult) => {
        if (err) return res.status(500).send("Error fetching program count");
        db.query(statsQuery.redemptions, (err, redemptionResult) => {
          if (err) return res.status(500).send("Error fetching redemption count");

          const stats = {
            total_users: userResult[0].total_users,
            total_programs: programResult[0].total_programs,
            total_redemptions: redemptionResult[0].total_redemptions
          };

          db.query(recentProgramsQuery, [adminID], (err, recentPrograms) => {
            if (err) return res.status(500).send("Error fetching recent programs");

            db.query(recentRedemptionsQuery, (err, recentRedemptions) => {
              if (err) return res.status(500).send("Error fetching recent redemptions");

              db.query(ongoingProgramsQuery, [adminID], (err, programs) => {
                if (err) return res.status(500).send("Error fetching ongoing programs");

                db.query(redeemedRewardsQuery, [adminID], (err, rewards) => {
                  if (err) return res.status(500).send("Error fetching redeemed rewards");

                  db.query(totalEarnedQuery, [adminID], (err, earnedResult) => {
                    if (err) return res.status(500).send("Error fetching points earned");

                    db.query(totalSpentQuery, [adminID], (err, spentResult) => {
                      if (err) return res.status(500).send("Error fetching points spent");

                      res.render('admin/dashboard', {
                        admin,
                        stats,
                        recentPrograms,
                        recentRedemptions,
                        programs,
                        rewards,
                        points: {
                          earned: earnedResult[0].total_earned || 0,
                          spent: spentResult[0].total_spent || 0,
                          balance: admin.total_point || 0
                        }
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
};
