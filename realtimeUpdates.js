const db = require('./db');

const updateProgramStatus = () => {
  // 1. Reset all future timeslots statuses to 'Registered'
  const resetStatus = `
    UPDATE staff_program sp
    JOIN Timeslot t ON sp.timeslotID = t.timeslotID
    SET sp.Status = 'Registered'
    WHERE CONCAT(t.Date, ' ', t.Start_Time) > NOW()
  `;

  // 2. Set only the next upcoming timeslot per staff to 'Upcoming'
  const setUpcoming = `
    UPDATE staff_program sp
JOIN (
  SELECT sp2.staffID, MIN(t2.Date) AS next_date
  FROM staff_program sp2
  JOIN Timeslot t2 ON sp2.timeslotID = t2.timeslotID
  WHERE CONCAT(t2.Date, ' ', t2.Start_Time) > NOW()
  GROUP BY sp2.staffID
) AS next_per_staff ON sp.staffID = next_per_staff.staffID
JOIN Timeslot t ON sp.timeslotID = t.timeslotID
SET sp.Status = 'Upcoming'
WHERE t.Date = next_per_staff.next_date
  AND CONCAT(t.Date, ' ', t.Start_Time) > NOW()
  AND sp.Status = 'Registered'
  `;

  db.query(resetStatus, (err) => {
    if (err) {
      console.error('[Reset Status Error]', err);
      return;
    }

    db.query(setUpcoming, (err2) => {
      if (err2) {
        console.error('[Set Upcoming Error]', err2);
        return;
      }

      console.log(`[${new Date().toLocaleString()}] Program statuses updated successfully.`);
    });
  });
};

module.exports = updateProgramStatus;
