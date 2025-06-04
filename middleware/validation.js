//Validation for registry
const validateReg = (req, res, next) => {
    const { staffID, name, email, password, role, department } = req.body;
    let regErrors = [];

    if (!staffID) regErrors.push('Staff ID is required');
    if (!name) regErrors.push('Full Name is required');
    if (!email) regErrors.push('Email is required');
    if (!password) regErrors.push('Password is required');
    if (!role) regErrors.push('Role is required');
    if (!department) regErrors.push('Department is required');
    
    if (password) {
        if (password.length < 6) {
            regErrors.push('Password should be at least 6 characters long');
        }
        if (!/\d/.test(password)) {
            regErrors.push('Password must contain at least one number');
        }
        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            regErrors.push('Password must contain at least one special character (e.g., !@#$%^&*)');
        }
    }
    
    if (regErrors.length > 0) {
        regErrors.forEach(regError => req.flash('regErrors', regError));
        req.flash('regData', req.body);
        return res.redirect('/admin/register');
    }

    
    next();
};


//Validate log in

const validateLogin= (req,res,next)=>{
    const {staffID, password}=req.body;
    if (!staffID || !password){
        req.flash('error', 'All fields are required.');
        return res.redirect('/')
    }
    next();
};

module.exports = {
    validateReg,
    validateLogin
};