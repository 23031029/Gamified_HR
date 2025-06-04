-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jul 31, 2024 at 06:06 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `Gamified_HR`
CREATE DATABASE gamified_hr;
USE gamified_hr;

--

-- --------------------------------------------------------
-- Table: Department
CREATE TABLE Department (
    departmentID VARCHAR(10) PRIMARY KEY,
    name VARCHAR(100)
);
INSERT INTO Department (departmentID, name) VALUES
('D001', 'HR'),
('D002', 'Finance'),
('D003', 'Marketing'),
('D004', 'IT');

-- Table: Staff
CREATE TABLE Staff (
    staffID VARCHAR(10) PRIMARY KEY,
    name VARCHAR(200),
    email VARCHAR(200),
    password VARCHAR(200),
    gender Char(5),
    role VARCHAR(50),
    profile_image TEXT,
    department VARCHAR(10),
    date_join DATE,
    status CHAR(10),
    total_point INT(100),
    FOREIGN KEY (department) REFERENCES Department(departmentID)
);

INSERT INTO Staff (staffID, name, email, password, gender, role, profile_image, department, date_join, status, total_point) VALUES
('S001', 'Serah', 'admin@gmail.com', SHA1('admin123'), "F", 'admin', "serah.jpg", 'D001', CURDATE(), 'Active', 280),
('S002', 'John', 'finance@gmail.com', SHA1('finance123'),"M", 'user', "john.jpg", 'D002', CURDATE(), 'Active', 860),
('S003', 'Alice', 'marketing@gmail.com', SHA1('marketing123'),"F", 'user', "alice.jpg", 'D003', CURDATE(), 'Active', 500),
('S004', 'Bob', 'it@gmail.com', SHA1('it123'), "M",'user', "bob.jpg", 'D004', CURDATE(), 'Active', 350),
('S005', 'Emma', 'emma.hr@gmail.com', SHA1('emma123'), 'F', 'user', 'default.png', 'D001', CURDATE(), 'Active', 300),
('S006', 'Liam', 'liam.finance@gmail.com', SHA1('liam123'), 'M', 'user', 'default.png', 'D002', CURDATE(), 'Active', 420),
('S007', 'Olivia', 'olivia.marketing@gmail.com', SHA1('olivia123'), 'F', 'user', 'default.png', 'D003', CURDATE(), 'Active', 380),
('S008', 'Noah', 'noah.it@gmail.com', SHA1('noah123'), 'M', 'user', 'default.png', 'D004', CURDATE(), 'Active', 410);

-- Table: Reward
CREATE TABLE Reward (
    RewardID VARCHAR(10) PRIMARY KEY,
    name VARCHAR(200),
    description TEXT,
    points INT(10),
    stock INT(20),
    image TEXT
);
INSERT INTO Reward (RewardID, name, description, points, stock, image) VALUES
('R001', 'Coffee Voucher', 'Redeemable at any Starbucks outlet', 100, 10, NULL),
('R002', 'Movie Ticket', '1 Standard ticket for Golden Village', 150, 5, NULL),
('R003', 'Extra Day Off', '1 extra vacation day', 500, 2, NULL),
('R004', 'Company Mug', 'Limited edition mug with company logo', 50, 20, "casugolMug.png");


-- Table: Redeem
CREATE TABLE Redeem (
    RedemptionID INT PRIMARY KEY,
    staffID VARCHAR(10),
    RewardID VARCHAR(20),
    Redeem_Date DATE,
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
    ProgramID VARCHAR(10) PRIMARY KEY,
    Title VARCHAR(100),
    Description TEXT,
    Type VARCHAR(300),
    Start_Date DATE,
    End_Date DATE,
    Start_Time TIME,
    End_Time TIME,
    Created_By VARCHAR(10),
    points_reward INT(30),
    avaliable_slots INT(5),
    QR_code VARCHAR(9999),
    FOREIGN KEY (Created_By) REFERENCES Staff(staffID)
);


INSERT INTO Program (ProgramID, Title, Description, Type, Start_Date, End_Date, Start_Time, End_Time, Created_By, points_reward, avaliable_slots, QR_code) VALUES
('P001', 'Wellness Challenge', 'Complete daily step goals', 'Health & Wellness', '2024-07-01', '2024-07-31', '09:00:00', '17:00:00', 'S001', 100, 20, NULL),
('P002', 'Training 101', 'Onboarding training for new hires', 'Training', '2024-08-01', '2024-08-15', '10:00:00', '15:00:00', 'S001', 150, 10, NULL),
('P003', 'Leadership Workshop', 'Enhance leadership skills', 'Training', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 7 DAY), '09:00:00', '12:00:00', 'S002', 200, 15, NULL),
('P004', 'Yoga & Mindfulness', 'Weekly Yoga sessions', 'Health & Wellness', DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 30 DAY), '07:00:00', '08:00:00', 'S003', 120, 25, NULL),
('P005', 'Cybersecurity Basics', 'Training on cybersecurity fundamentals', 'Training', DATE_ADD(CURDATE(), INTERVAL 3 DAY), DATE_ADD(CURDATE(), INTERVAL 10 DAY), '14:00:00', '16:00:00', 'S004', 180, 10, NULL);



-- Table: start_program
CREATE TABLE staff_program (
    participantID INT PRIMARY KEY,
    staffID VARCHAR(10),
    programID VARCHAR(10),
    Status CHAR(30),
    Progress_Result TEXT,
    Name VARCHAR(200),
    points_earned INT(200),
    completed_date DATE,
    FOREIGN KEY (staffID) REFERENCES Staff(staffID),
    FOREIGN KEY (programID) REFERENCES Program(ProgramID)
);
INSERT INTO staff_program (participantID, staffID, programID, Status, Progress_Result, Name, points_earned, completed_date) VALUES
(1, 'S002', 'P001', 'Completed', '10,000 steps/day', 'Wellness Challenge', 100, '2024-07-31'),
(2, 'S003', 'P002', 'Ongoing', '50% Completed', 'Training 101', 75, NULL),
(3, 'S001', 'P003', 'Ongoing', '30% Completed', 'Leadership Workshop', 60, NULL),
(4, 'S004', 'P003', 'Completed', 'Completed all modules', 'Leadership Workshop', 200, '2024-08-07'),
(5, 'S002', 'P004', 'Ongoing', 'Attended 2 sessions', 'Yoga & Mindfulness', 40, NULL),
(6, 'S003', 'P004', 'Completed', 'Completed 8 sessions', 'Yoga & Mindfulness', 120, '2024-08-28'),
(7, 'S004', 'P005', 'Ongoing', 'First half done', 'Cybersecurity Basics', 90, NULL),
(8, 'S001', 'P005', 'Completed', 'Finished all lessons', 'Cybersecurity Basics', 180, '2024-08-13');


-- Table: Program_Feedback
CREATE TABLE Program_Feedback (
    FeedbackID INT PRIMARY KEY,
    staffID varchar(10),
    ProgramID VARCHAR(200),
    Rating FLOAT(5,1),
    Comments TEXT,
    Submitted_Date DATE,
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



/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
