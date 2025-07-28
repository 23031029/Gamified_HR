const db = require('../db');
const update = require('../realtimeUpdates');

exports.getChatPage = (req, res) => {
  const staffID = req.session.staff.staffID;

  const staffQuery = `
    SELECT staffID, CONCAT(first_name, ' ', last_name) AS name, profile_image
    FROM Staff
    WHERE staffID != ?
  `;
  db.query(staffQuery, [staffID], (err, staffList) => {
    if (err) return res.status(500).send("Error loading staff list");

    res.render('user/chat', { staffList, currentPath: req.path });
  });
};

exports.getMessages = (req, res) => {
  const { to } = req.params;
  const from = req.session.staff.staffID;

  const query = `
    SELECT * FROM Messages
    WHERE (senderID = ? AND receiverID = ?)
       OR (senderID = ? AND receiverID = ?)
    ORDER BY sent_at ASC
  `;

  db.query(query, [from, to, to, from], (err, results) => {
    if (err) return res.status(500).json({ success: false });

    const markAsReadQuery = `
      UPDATE Messages
      SET is_read = 1
      WHERE senderID = ? AND receiverID = ? AND is_read = 0
    `;
    db.query(markAsReadQuery, [to, from], () => {});

    res.json(results);
  });
};

exports.sendMessage = (req, res) => {
  const { receiverID, content } = req.body;
  const senderID = req.session.staff.staffID;

  const query = `INSERT INTO Messages (senderID, receiverID, content) VALUES (?, ?, ?)`;
  db.query(query, [senderID, receiverID, content], (err) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true });
  });
};

exports.getUnreadCounts = (req, res) => {
  const currentUser = req.session.staff?.staffID;

  if (!currentUser) return res.status(401).json({ error: 'Not logged in' });

  const sql = `
    SELECT senderID, COUNT(*) as unreadCount
    FROM Messages
    WHERE receiverID = ? AND is_read = 0
    GROUP BY senderID
  `;

  db.query(sql, [currentUser], (err, results) => {
    if (err) return res.status(500).json({ error: 'DB error' });

    const counts = {};
    results.forEach(row => {
      counts[row.senderID] = row.unreadCount;
    });

    res.json(counts)
  });
};


// =========================
// INVITE FEATURE
// =========================

exports.sendProgramInvite = (req, res) => {
  const inviterID = req.session.staff.staffID;
  const { inviteeIDs, programID } = req.body;

  let invitees = Array.isArray(inviteeIDs) ? inviteeIDs : [inviteeIDs];

  invitees = invitees.filter(id => id !== inviterID);

  if (invitees.length === 0) {
    return res.json({ success: false, message: "No valid invitees selected." });
  }

  const values = invitees.map(id => [inviterID, id, programID]);

  const query = `INSERT IGNORE INTO Program_Invite (InviterID, InviteeID, ProgramID) VALUES ?`;

  db.query(query, [values], (err, result) => {
    if (err) return res.json({ success: false, message: "Database error" });
    res.json({ success: true, invitedCount: result.affectedRows });
  });
};

exports.viewInvites = (req, res) => {
  const staffID = req.session.staff.staffID;

  const query = `
    SELECT pi.*, 
           p.Title, 
           CONCAT(s.first_name, ' ', s.last_name) AS inviter_name
    FROM Program_Invite pi
    JOIN Program p ON pi.ProgramID = p.ProgramID
    JOIN Staff s ON pi.InviterID = s.staffID
    WHERE pi.InviteeID = ?
    ORDER BY pi.created_at DESC
  `;

  db.query(query, [staffID], (err, invites) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Error loading invites");
    }

    res.render('user/invites', {
      invites,
      currentPath: req.path
    });
  });
};
