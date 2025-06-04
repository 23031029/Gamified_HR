const db = require('../db');

exports.getSignIn= (req, res)=>{
    res.render('user/index', {
        message: req.flash('success'),
        error: req.flash('error')
    });
};

exports.getRegister = (req, res) => {
    const getDepartments = `SELECT * FROM department`;

    db.query(getDepartments, (err, departments) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Database error');
        }

        const regErrors = req.flash('regErrors');
        const regData = req.flash('regData')[0] || {};

        res.render('admin/register', {
            department: departments,
            regData,
            regErrors
        });
    });
};




exports.login=(req,res)=>{
    const {staffID, password}= req.body;
    const sql=`Select * from staff WHERE staffID= ? AND password=SHA1(?)`;
    db.query(sql, [staffID, password], (err, results)=>{
        if(err){
            throw err;
        }

        if (results.length>0){
            req.session.staff= results[0];
            req.flash('success', 'Login success');
            if(req.session.staff.role=='user')
            res.redirect('/user/dashboard');
            else if(req.session.staff.role=='admin')
            res.redirect('/admin/dashboard');
        } else {
            req.flash('error', 'Invalid email or password.');
            res.redirect('/');
        }
    });
};

exports.register = (req, res) => {
    const { staffID, name, email, password, role, department } = req.body;
    let profile = 'default.jpg';
    
    if (req.file) {
        profile = req.file.filename;
    }

    const sql = `INSERT INTO staff 
    (staffID, name, email, password, role, department, date_join, status, total_point, profile_image) 
    VALUES (?, ?, ?, SHA1(?), ?, ?, CURDATE(), 'Active', 0, ?)`;

    const checkStaffID = `SELECT * FROM staff WHERE staffID = ?`;
    const checkEmail = `SELECT * FROM staff WHERE email = ?`;

    // Check if Staff ID already exists
    db.query(checkStaffID, [staffID], (err, result) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Error checking Staff ID');
            req.flash('formData', req.body);
            return res.redirect('/admin/register');
        }
        
        if (result.length > 0) {
            req.flash('error', 'Staff ID already exists');
            req.flash('formData', req.body);
            return res.redirect('/admin/register');
        }
        
        // Check if email already exists
        db.query(checkEmail, [email], (err, emailResult) => {
            if (err) {
                console.error(err);
                req.flash('error', 'Error checking email');
                req.flash('formData', req.body);
                return res.redirect('/admin/register');
            }
            
            if (emailResult.length > 0) {
                req.flash('error', 'Email address is already registered');
                req.flash('formData', req.body);
                return res.redirect('/admin/register');
            }
            
            // Both Staff ID and email are available, proceed with registration
            db.query(sql, [staffID, name, email, password, role, department, profile], (err, result) => {
                if (err) {
                    console.error(err);
                    req.flash('error', 'Error registering user');
                    req.flash('formData', req.body);
                    return res.redirect('/admin/register');
                }
                
                req.flash('success', 'User registered successfully');
                res.redirect('/admin/dashboard');
            });
        });
    });
};

exports.logout= (req, res)=>{
    req.session.destroy((err)=>{
        if (err) {
            return res.status(500).send("Failed to log out.");
          }
          res.redirect('/'); 
    })
}
