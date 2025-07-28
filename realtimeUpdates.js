const db = require('./db');

const update = () => {
  const resetStatus = `
    UPDATE staff_program sp
    JOIN Timeslot t ON sp.timeslotID = t.timeslotID
    SET sp.Status = 'Registered'
    WHERE CONCAT(t.Date, ' ', t.Start_Time) > NOW()
  `;

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

  const setOngoing = `
    UPDATE staff_program sp
    JOIN Timeslot t ON sp.timeslotID = t.timeslotID
    SET sp.Status = 'Ongoing'
    WHERE NOW() BETWEEN CONCAT(t.Date, ' ', t.Start_Time)
                    AND ADDTIME(
                      ADDTIME(CONCAT(t.Date, ' ', t.Start_Time), SEC_TO_TIME(t.Duration * 60)),
                      '00:15:00'
                    )
      AND sp.Status != 'Completed'
  `;

  const setCancelled = `
    UPDATE staff_program sp
    JOIN Timeslot t ON sp.timeslotID = t.timeslotID
    SET sp.Status = 'Cancelled'
    WHERE NOW() > ADDTIME(
                    ADDTIME(CONCAT(t.Date, ' ', t.Start_Time), SEC_TO_TIME(t.Duration * 60)),
                    '00:15:00'
                 )
      AND sp.Status NOT IN ('Completed', 'Cancelled')
  `;

  const autoDeactivate = `
    UPDATE Program p
    SET p.status = 'Inactive'
    WHERE p.status = 'Active'
      AND NOT EXISTS (
        SELECT 1 FROM Timeslot t
        WHERE t.ProgramID = p.ProgramID
          AND CONCAT(t.Date, ' ', t.Start_Time) > NOW()
      )
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

      db.query(setOngoing, (err3) => {
        if (err3) {
          console.error('[Set Ongoing Error]', err3);
          return;
        }

        db.query(setCancelled, (err4) => {
          if (err4) {
            console.error('[Set Cancelled Error]', err4);
            return;
          }

          db.query(autoDeactivate, (err5) => {
            if (err5) {
              console.error('[Auto Deactivate Error]', err5);
              return;
            }
          });
        });
      });
    });
  });
};

module.exports = update;
