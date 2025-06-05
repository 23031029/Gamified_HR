// Validation for registry
const validateReg = (req, res, next) => {
    const { first, last, email, password, role, department, address, phone, dob } = req.body;
    let regErrors = [];

    if (!first) regErrors.push('First name is required');
    if (!last) regErrors.push('Last name is required');
    if (!email) regErrors.push('Email is required');
    if (!password) regErrors.push('Password is required');
    if (!role) regErrors.push('Role is required');
    if (!department) regErrors.push('Department is required');
    if (!address) regErrors.push('Home address is required');
    if (!phone) regErrors.push('Phone number is required');
    if (!dob) regErrors.push('Date of birth is required');

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

const validatePasswordChange = (req, res, next) => {
    const { newPassword, confirmPassword } = req.body;
    let errors = [];

    if (!newPassword || !confirmPassword) {
        errors.push('All password fields are required.');
    }
    if (newPassword !== confirmPassword) {
        errors.push('New passwords do not match.');
    }
    if (newPassword) {
        if (newPassword.length < 6) {
            errors.push('Password should be at least 6 characters long.');
        }
        if (!/\d/.test(newPassword)) {
            errors.push('Password must contain at least one number.');
        }
        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) {
            errors.push('Password must contain at least one special character (e.g., !@#$%^&*).');
        }
    }

    if (errors.length > 0) {
        req.flash('errorChange', errors.join(' '));
        return res.redirect('/user/change-password');
    }
    next();
};

module.exports = {
    validateReg,
    validateLogin,
    validatePasswordChange
};