DROP DATABASE IF EXISTS gamified_hr;
CREATE DATABASE gamified_hr;
USE gamified_hr;
 
-- Table: Department
CREATE TABLE Department (
    departmentID VARCHAR(10) NOT NULL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);
 
INSERT INTO Department (departmentID, name) VALUES
('D001', 'HR'),
('D002', 'Finance'),
('D003', 'Marketing'),
('D004', 'IT');
 
-- Table: Staff
CREATE TABLE Staff (
    staffID VARCHAR(10) NOT NULL PRIMARY KEY,
    first_name CHAR(100) NOT NULL,
    last_name CHAR(100) NOT NULL,
    email VARCHAR(200) NOT NULL,
    password VARCHAR(200) NOT NULL,
    gender CHAR(5) NOT NULL,
    home_address TEXT NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    dob DATE NOT NULL,
    role VARCHAR(50) NOT NULL,
    profile_image TEXT NOT NULL,
    department VARCHAR(10) NOT NULL,
    date_join DATE NOT NULL,
    `status` CHAR(10) NOT NULL,
    total_point INT DEFAULT 0,
    FOREIGN KEY (department) REFERENCES Department(departmentID)
);
 
INSERT INTO Staff (staffID, first_name, last_name, email, password, gender, home_address, phone_number, dob, role, profile_image, department, date_join, `status`, total_point) VALUES
('S001', 'Serah', 'Lee', 'admin@gmail.com', SHA1('admin123'), 'F', '123 Admin Ave, Singapore', '+6591234567', '1990-01-15', 'admin', 'serah.jpg', 'D001', CURDATE(), 'Active', 280),
('S002', 'John', 'Tan', 'finance@gmail.com', SHA1('finance123'), 'M', '88 Finance St, Singapore', '+6598765432', '1985-07-22', 'user', 'john.jpg', 'D002', CURDATE(), 'Active', 860),
('S003', 'Alice', 'Chia', 'marketing@gmail.com', SHA1('marketing123'), 'F', '12 Market Rd, Singapore', '+6588881234', '1992-11-10', 'user', 'alice.jpg', 'D003', CURDATE(), 'Active', 500),
('S004', 'Bob', 'Goh', 'it@gmail.com', SHA1('it123'), 'M', '77 Tech Blvd, Singapore', '+6577774321', '1988-03-05', 'user', 'bob.jpg', 'D004', CURDATE(), 'Active', 350),
('S005', 'Emma', 'Watson', 'emma.hr@gmail.com', SHA1('emma123'), 'F', '45 HR Way, Singapore', '+6566661212', '1993-08-19', 'user', 'default.png', 'D001', CURDATE(), 'Active', 300),
('S006', 'Liam', 'Chyne', 'liam.finance@gmail.com', SHA1('liam123'), 'M', '22 Money Lane, Singapore', '+6555553434', '1987-12-03', 'user', 'default.png', 'D002', CURDATE(), 'Active', 420),
('S007', 'Olivia', 'Choo', 'olivia.marketing@gmail.com', SHA1('olivia123'), 'F', '9 Brand Pl, Singapore', '+6544445678', '1994-05-14', 'user', 'default.png', 'D003', CURDATE(), 'Active', 380),
('S008', 'Noah', 'Yap', 'noah.it@gmail.com', SHA1('noah123'), 'M', '101 Code Ct, Singapore', '+6533337654', '1989-09-27', 'user', 'default.png', 'D004', CURDATE(), 'Active', 410);

 
-- Table: Reward
CREATE TABLE Reward (
    RewardID VARCHAR(10) NOT NULL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    points INT NOT NULL,
    stock INT NOT NULL,
    image TEXT
);
 
INSERT INTO Reward (RewardID, name, description, points, stock, image) VALUES
('R001', 'Coffee Voucher', 'Redeemable at any Starbucks outlet', 100, 10, 'starbucks.jpg'),
('R002', 'Free Macdonald Meal', '1 Mcspicy Meal with coke', 150, 5, 'mcd.png'),
('R003', 'Spa Voucher', 'Ful Body Massage for 2 hours', 500, 2, 'spa.png'),
('R004', 'Company Mug', 'Limited edition mug with company logo', 50, 20, 'casugolMug.png');

 
-- Table: Redeem
CREATE TABLE Redeem (
    RedemptionID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    staffID VARCHAR(10) NOT NULL,
    RewardID VARCHAR(20) NOT NULL,
    Redeem_Date DATETIME NOT NULL,
    FOREIGN KEY (staffID) REFERENCES Staff(staffID),
    FOREIGN KEY (RewardID) REFERENCES Reward(RewardID)
);
 
INSERT INTO Redeem (RedemptionID, staffID, RewardID, Redeem_Date) VALUES
(1, 'S002', 'R001', DATE_SUB(CONCAT(CURDATE(), ' 09:15:00'), INTERVAL 0 DAY)),
(2, 'S003', 'R004', DATE_SUB(CONCAT(CURDATE(), ' 14:45:00'), INTERVAL 10 DAY)),
(3, 'S001', 'R002', DATE_SUB(CONCAT(CURDATE(), ' 11:30:00'), INTERVAL 30 DAY)),
(4, 'S004', 'R003', DATE_SUB(CONCAT(CURDATE(), ' 16:20:00'), INTERVAL 5 DAY)),
(5, 'S001', 'R001', DATE_SUB(CONCAT(CURDATE(), ' 08:05:00'), INTERVAL 0 DAY)),
(6, 'S002', 'R003', DATE_SUB(CONCAT(CURDATE(), ' 19:00:00'), INTERVAL 15 DAY)),
(7, 'S003', 'R002', DATE_SUB(CONCAT(CURDATE(), ' 12:10:00'), INTERVAL 0 DAY)),
(8, 'S004', 'R004', DATE_SUB(CONCAT(CURDATE(), ' 17:55:00'), INTERVAL 1 DAY));


-- Table: Program_type
CREATE TABLE Program_type(
typeID INT(10) NOT NULL AUTO_INCREMENT PRIMARY KEY,
name varchar(100) NOT NULL
);
INSERT INTO Program_type (typeID, name) VALUES
(1, "Training"),
(2, "Health & Wellness"),
(3, "Workshop");
 
-- Table: Program
CREATE TABLE Program (
    ProgramID VARCHAR(10) NOT NULL PRIMARY KEY,
    TypeID Int(10) NOT NULL,
    Title VARCHAR(100) NOT NULL,
    Description TEXT NOT NULL,
    Created_By VARCHAR(10) NOT NULL,
    points_reward INT NOT NULL,
    status ENUM('Active', 'Inactive') DEFAULT 'Active',
    FOREIGN KEY (Created_By) REFERENCES Staff(staffID),
    FOREIGN KEY (TypeID) REFERENCES Program_type(typeID)
);
 
INSERT INTO Program (ProgramID, Title, Description, TypeID, Created_By, points_reward) VALUES
('P001', 'Wellness Challenge', 'Complete daily step goals',2 , 'S001', 100),
('P002', 'Training 101', 'Onboarding training for new hires', 1 , 'S001', 150),
('P003', 'Leadership Workshop', 'Enhance leadership skills', 1, 'S001', 200),
('P004', 'Yoga & Mindfulness', 'Weekly Yoga sessions', 2, 'S001', 120),
('P005', 'Cybersecurity Basics', 'Training on cybersecurity fundamentals', 1, 'S004', 180);
 
CREATE TABLE Timeslot (
    timeslotID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    ProgramID VARCHAR(10) NOT NULL,
    Date DATE NOT NULL,
    Start_Time TIME NOT NULL,
    Duration INT NOT NULL,
    Slots_availablility INT(5) NOT NULL,
    FOREIGN KEY (ProgramID) REFERENCES Program(ProgramID)
);

 
 
-- P001: Wellness Challenge
-- Same time, different dates
-- Same date, different times
INSERT INTO Timeslot (ProgramID, Date, Start_Time, Duration, Slots_availablility) VALUES
('P001', '2025-06-10', '09:00:00', 60, 20), -- original
('P001', '2025-06-17', '09:00:00', 60, 18), -- same time, next week
('P001', '2025-06-10', '15:00:00', 60, 15); -- same day, different time
 
-- P002: Training 101
INSERT INTO Timeslot (ProgramID, Date, Start_Time, Duration, Slots_availablility) VALUES
('P002', '2025-05-11', '10:00:00', 90, 15),
('P002', '2025-05-11', '14:00:00', 90, 10),
('P002', '2025-05-18', '10:00:00', 90, 15);
 
-- P003: Leadership Workshop
INSERT INTO Timeslot (ProgramID, Date, Start_Time, Duration, Slots_availablility) VALUES
('P003', '2025-07-12', '14:00:00', 120, 10), -- original
('P003', '2025-07-12', '09:00:00', 120, 12), -- same day, earlier time
('P003', '2025-07-19', '14:00:00', 120, 10), -- same time, different date
('P003', '2025-07-28', '10:00:00', 90, 10);

-- P004: Yoga & Mindfulness
INSERT INTO Timeslot (ProgramID, Date, Start_Time, Duration, Slots_availablility) VALUES
('P004', '2025-07-13', '08:30:00', 60, 12), -- original
('P004', '2025-07-13', '18:00:00', 60, 10), -- same day, different time
('P004', '2025-07-20', '08:30:00', 60, 14); -- same time, different date
 
-- P005: Cybersecurity Basics
INSERT INTO Timeslot (ProgramID, Date, Start_Time, Duration, Slots_availablility) VALUES
('P005', '2025-07-14', '11:00:00', 90, 18), -- original
('P005', '2025-07-09', '16:00:00', 90, 12), -- same day, different time
('P005', '2025-07-27', '21:00:00', 90, 20); -- same time, different date
 
 
-- Updated Table: staff_program
CREATE TABLE staff_program (
    participantID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    staffID VARCHAR(10) NOT NULL,
    programID VARCHAR(10) NOT NULL,
    timeslotID INT NOT NULL,
    `Status` CHAR(30) NOT NULL,
    feedbackSubmitted BOOLEAN DEFAULT 0,
    FOREIGN KEY (staffID) REFERENCES Staff(staffID),
    FOREIGN KEY (programID) REFERENCES Program(ProgramID),
    FOREIGN KEY (timeslotID) REFERENCES Timeslot(timeslotID)
);
 
-- Sample INSERTs for staff_program
-- Continuing from earlier inserts
INSERT INTO staff_program (staffID, programID, timeslotID, `Status`) VALUES
('S005', 'P001', 1, 'Completed'),       -- first morning slot
('S006', 'P001', 2, 'Completed'),     -- next week's same time
('S002', 'P001', 2, 'Completed'),     -- next week's same time
('S003', 'P001', 3, 'Completed'),       -- same day, different time
 
('S004', 'P002', 4, 'Completed'),     -- original 10am
('S002', 'P002', 4, 'Completed'),     -- original 10am
('S001', 'P002', 5, 'Completed'),       -- same day, afternoon
 
('S005', 'P003', 7, 'Registered'),     -- original afternoon
('S006', 'P003', 8, 'Registered'),       -- morning
('S004', 'P003', 9, 'Registered'),    -- next week's afternoon
 
('S001', 'P004', 10, 'Registered'),    -- morning Yoga
('S003', 'P004', 11, 'Registered'),      -- evening Yoga
('S002', 'P004', 12, 'Registered'),   -- next week morning
 
('S006', 'P005', 13, 'Completed'),    -- first Cyber slot
('S005', 'P005', 14, 'Ongoing'),      -- same day, different time
('S003', 'P005', 15, 'Registered'),  -- next week's same time
('S002', 'P005', 16, "Ongoing");
 
-- Table: Program_Feedback
CREATE TABLE Program_Feedback (
    FeedbackID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    staffID VARCHAR(10) NOT NULL,
    ProgramID VARCHAR(10) NOT NULL,
    Rating FLOAT(5,1) NOT NULL,
    Tags TEXT, 
    Comments TEXT NOT NULL,
    Submitted_Date DATE NOT NULL,
    FOREIGN KEY (staffID) REFERENCES Staff(staffID),
    FOREIGN KEY (ProgramID) REFERENCES Program(ProgramID)
);
 
-- INSERT Program_Feedback
INSERT INTO Program_Feedback (FeedbackID, staffID, ProgramID, Rating, Comments, Submitted_Date) VALUES
(1, 'S002', 'P001', 4.5, 'Great way to stay fit!', '2024-08-01'),
(2, 'S003', 'P002', 4.0, 'Very informative session.', '2024-08-16'),
(3, 'S001', 'P003', 4.8, 'Loved the leadership insights and practical tips!', '2024-08-10'),
(4, 'S004', 'P003', 4.2, 'Good program but could use more interactive activities.', '2024-08-15'),
(5, 'S002', 'P004', 3.9, 'Helpful for relaxation, but needs more session variety.', '2024-08-20'),
(6, 'S003', 'P004', 4.7, 'Great instructor and well structured.', '2024-08-29'),
(7, 'S004', 'P005', 4.0, 'Useful content for cybersecurity basics.', '2024-08-18'),
(8, 'S001', 'P005', 4.5, 'Enjoyed the lessons, learned a lot.', '2024-08-22');
 
CREATE TABLE Messages (
  messageID INT AUTO_INCREMENT PRIMARY KEY,
  senderID VARCHAR(10) NOT NULL,
  receiverID VARCHAR(10) NOT NULL,
  content TEXT NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_read BOOLEAN DEFAULT 0,
  FOREIGN KEY (senderID) REFERENCES Staff(staffID),
  FOREIGN KEY (receiverID) REFERENCES Staff(staffID)
);

CREATE TABLE Program_Invite (
  InviteID INT AUTO_INCREMENT PRIMARY KEY,
  InviterID VARCHAR(10) NOT NULL,
  InviteeID VARCHAR(10) NOT NULL,
  ProgramID VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_invite (InviterID, InviteeID, ProgramID),
  FOREIGN KEY (InviterID) REFERENCES Staff(staffID),
  FOREIGN KEY (InviteeID) REFERENCES Staff(staffID),
  FOREIGN KEY (ProgramID) REFERENCES Program(ProgramID)
);

CREATE TABLE IF NOT EXISTS Staff_Milestone (
  staffID VARCHAR(10),
  milestone INT,
  bonus_points INT,
  awarded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (staffID, milestone)
);




