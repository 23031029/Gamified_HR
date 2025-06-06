-- Gamified_HR Database Schema
-- Cleaned and corrected version
 
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
('R001', 'Coffee Voucher', 'Redeemable at any Starbucks outlet', 100, 10, 'starbucks.png'),
('R002', 'Free Macdonald Meal', '1 Mcspicy Meal with coke', 150, 5, 'mcd.png'),
('R003', 'Spa Voucher', 'Ful Body Massage for 2 hours', 500, 2, 'spa.png'),
('R004', 'Company Mug', 'Limited edition mug with company logo', 50, 20, 'casugolMug.png');
 
-- Table: Redeem
CREATE TABLE Redeem (
    RedemptionID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    staffID VARCHAR(10) NOT NULL,
    RewardID VARCHAR(20) NOT NULL,
    Redeem_Date DATE NOT NULL,
    FOREIGN KEY (staffID) REFERENCES Staff(staffID),
    FOREIGN KEY (RewardID) REFERENCES Reward(RewardID)
);
 
INSERT INTO Redeem (RedemptionID, staffID, RewardID, Redeem_Date) VALUES
(1, 'S002', 'R001', CURDATE()),
(2, 'S003', 'R004', DATE_SUB(CURDATE(), INTERVAL 10 DAY)),
(3, 'S001', 'R002', DATE_SUB(CURDATE(), INTERVAL 30 DAY)),
(4, 'S004', 'R003', DATE_SUB(CURDATE(), INTERVAL 5 DAY)),
(5, 'S001', 'R001', CURDATE()),
(6, 'S002', 'R003', DATE_SUB(CURDATE(), INTERVAL 15 DAY)),
(7, 'S003', 'R002', CURDATE()),
(8, 'S004', 'R004', DATE_SUB(CURDATE(), INTERVAL 1 DAY));
 
-- Table: Program
CREATE TABLE Program (
    ProgramID VARCHAR(10) NOT NULL PRIMARY KEY,
    Title VARCHAR(100) NOT NULL,
    Description TEXT NOT NULL,
    Type VARCHAR(300) NOT NULL,
    Start_Date DATE NOT NULL,
    End_Date DATE NOT NULL,
    Start_Time TIME NOT NULL,
    End_Time TIME NOT NULL,
    Created_By VARCHAR(10) NOT NULL,
    points_reward INT NOT NULL,
    avaliable_slots INT NOT NULL,
    QR_code TEXT,
    FOREIGN KEY (Created_By) REFERENCES Staff(staffID)
);
 
INSERT INTO Program (ProgramID, Title, Description, Type, Start_Date, End_Date, Start_Time, End_Time, Created_By, points_reward, avaliable_slots, QR_code) VALUES
('P001', 'Wellness Challenge', 'Complete daily step goals', 'Health & Wellness', '2024-07-01', '2024-07-31', '09:00:00', '17:00:00', 'S001', 100, 20, NULL),
('P002', 'Training 101', 'Onboarding training for new hires', 'Training', '2024-08-01', '2024-08-15', '10:00:00', '15:00:00', 'S001', 150, 10, NULL),
('P003', 'Leadership Workshop', 'Enhance leadership skills', 'Training', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 7 DAY), '09:00:00', '12:00:00', 'S001', 200, 15, NULL),
('P004', 'Yoga & Mindfulness', 'Weekly Yoga sessions', 'Health & Wellness', DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 30 DAY), '07:00:00', '08:00:00', 'S001', 120, 25, NULL),
('P005', 'Cybersecurity Basics', 'Training on cybersecurity fundamentals', 'Training', DATE_ADD(CURDATE(), INTERVAL 3 DAY), DATE_ADD(CURDATE(), INTERVAL 10 DAY), '14:00:00', '16:00:00', 'S004', 180, 10, NULL);
 
-- Table: staff_program
CREATE TABLE staff_program (
    participantID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    staffID VARCHAR(10) NOT NULL,
    programID VARCHAR(10) NOT NULL,
	Start_Date DATE NOT NULL,
    End_Date DATE NOT NULL,
    Start_Time TIME NOT NULL,
    End_Time TIME NOT NULL,
    `Status` CHAR(30) NOT NULL,
    Progress_Result TEXT NOT NULL,
    Name VARCHAR(200) NOT NULL,
    points_earned INT NOT NULL,
    completed_date DATE NOT NULL,
    FOREIGN KEY (staffID) REFERENCES Staff(staffID),
    FOREIGN KEY (programID) REFERENCES Program(ProgramID)
);
 
INSERT INTO staff_program (participantID, staffID, programID, Start_Date, End_Date, Start_Time, End_Time, `Status`, Progress_Result, Name, points_earned, completed_date) VALUES
(1, 'S002', 'P001', '2024-07-01', '2024-07-31', '09:00:00', '10:00:00', 'Completed', '10,000 steps/day', 'Wellness Challenge', 100, '2024-07-31'),
(2, 'S003', 'P002', '2024-08-01', '2024-08-15', '10:00:00', '11:00:00', 'Ongoing', '50% Completed', 'Training 101', 75, '2025-06-04'),
(3, 'S001', 'P003', '2025-06-06', '2025-06-13', '09:00:00', '10:00:00', 'Ongoing', '30% Completed', 'Leadership Workshop', 60, '2025-06-04'),
(4, 'S004', 'P003', '2025-06-06', '2025-06-13', '09:00:00', '10:00:00', 'Completed', 'Completed all modules', 'Leadership Workshop', 200, '2024-08-07'),
(5, 'S002', 'P004', '2025-06-07', '2025-07-06', '07:00:00', '08:00:00', 'Ongoing', 'Attended 2 sessions', 'Yoga & Mindfulness', 40, '2025-06-04'),
(6, 'S003', 'P004', '2025-06-07', '2025-07-06', '07:00:00', '08:00:00', 'Completed', 'Completed 8 sessions', 'Yoga & Mindfulness', 120, '2024-08-28'),
(7, 'S004', 'P005', '2025-06-09', '2025-06-16', '14:00:00', '15:00:00', 'Ongoing', 'First half done', 'Cybersecurity Basics', 90, '2025-06-04'),
(8, 'S001', 'P005', '2025-06-09', '2025-06-16', '14:00:00', '15:00:00', 'Completed', 'Finished all lessons', 'Cybersecurity Basics', 180, '2024-08-13'),
(9, 'S005', 'P002', '2024-08-01', '2024-08-15', '10:00:00', '11:00:00', 'Completed', 'Final assessment passed', 'Training 101', 150, '2025-06-02'),
(10, 'S001', 'P001', '2024-07-01', '2024-07-31', '09:00:00', '10:00:00', 'Completed', 'All steps logged', 'Wellness Challenge', 130, '2025-06-03'),
(11, 'S002', 'P003', '2025-06-06', '2025-06-13', '09:00:00', '10:00:00', 'Completed', 'Presented final project', 'Leadership Workshop', 180, '2025-06-04'),
(12, 'S003', 'P005', '2025-06-09', '2025-06-16', '14:00:00', '15:00:00', 'Completed', 'Completed all tasks', 'Cybersecurity Basics', 200, '2025-06-01'),
(13, 'S004', 'P004', '2025-06-07', '2025-07-06', '07:00:00', '08:00:00', 'Completed', 'Meditation and yoga series done', 'Yoga & Mindfulness', 160, '2025-06-03');
 
-- Table: Program_Feedback
CREATE TABLE Program_Feedback (
    FeedbackID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    staffID VARCHAR(10) NOT NULL,
    ProgramID VARCHAR(10) NOT NULL,
    Rating FLOAT(5,1) NOT NULL,
    Comments TEXT NOT NULL,
    Submitted_Date DATE NOT NULL,
    FOREIGN KEY (staffID) REFERENCES Staff(staffID),
    FOREIGN KEY (ProgramID) REFERENCES Program(ProgramID)
);
 
INSERT INTO Program_Feedback (FeedbackID, staffID, ProgramID, Rating, Comments, Submitted_Date) VALUES
(1, 'S002', 'P001', 4.5, 'Great way to stay fit!', '2024-08-01'),
(2, 'S003', 'P002', 4.0, 'Very informative session.', '2024-08-16'),
(3, 'S001', 'P003', 4.8, 'Loved the leadership insights and practical tips!', '2024-08-10'),
(4, 'S004', 'P003', 4.2, 'Good program but could use more interactive activities.', '2024-08-15'),
(5, 'S002', 'P004', 3.9, 'Helpful for relaxation, but needs more session variety.', '2024-08-20'),
(6, 'S003', 'P004', 4.7, 'Great instructor and well structured.', '2024-08-29'),
(7, 'S004', 'P005', 4.0, 'Useful content for cybersecurity basics.', '2024-08-18'),
(8, 'S001', 'P005', 4.5, 'Enjoyed the lessons, learned a lot.', '2024-08-22');
 
 CREATE TABLE Program_Booking (
    BookingID INT AUTO_INCREMENT PRIMARY KEY,
    ProgramID VARCHAR(10) NOT NULL,
    staffID VARCHAR(10) NOT NULL,
    slot_date DATE NOT NULL,
    slot_time VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ProgramID) REFERENCES Program(ProgramID),
    FOREIGN KEY (staffID) REFERENCES Staff(staffID)
);

INSERT INTO Program_Booking (ProgramID, staffID, slot_date, slot_time) VALUES
('P005', 'S005', '2025-06-09', '02:00 PM - 03:00 PM'),
('P004', 'S008', '2025-06-10', '07:00 AM - 08:00 AM'),
('P003', 'S007', '2025-06-07', '09:00 AM - 10:00 AM'),
('P002', 'S006', '2024-08-02', '10:00 AM - 11:00 AM'),
('P004', 'S001', '2025-06-11', '07:00 AM - 08:00 AM');

CREATE TABLE leaderboard_history (
    Leaderboard_ID INT AUTO_INCREMENT PRIMARY KEY,
    year INT NOT NULL,
    half ENUM('H1', 'H2') NOT NULL, 
    rank_position INT NOT NULL, 
    staffID VARCHAR(10) NOT NULL,
    reward TEXT NOT NULL,
    FOREIGN KEY (staffID) REFERENCES staff(staffID)
);
INSERT INTO leaderboard_history (year, half, rank_position, staffID, reward) VALUES
(2024, 'H2', 1, 'S002', '2 Nights Stay at Hard Rock Hotel Singapore'),
(2024, 'H2', 2, 'S003', '2 Tickets to Universal Studios Singapore'),
(2024, 'H2', 3, 'S004', '4 Tickets to Singapore Mandai Zoo');