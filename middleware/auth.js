//Check if user is logged in
const checkAuthentication= (req,res,next)=>{
    if (req.session.staff){
        return next()
    } else{
        req.flash('error', 'Please log in to view this page.')
        res.redirect('/')
    }
}

//Check if user is admin
const checkAdmin = (req, res, next) => {
    if (req.session.staff && req.session.staff.role === 'admin') {
        return next();
    } else {
        req.flash('error', 'Access denied.');
        res.redirect('/user/dashboard');
    }
};


// Middleware to check if user is logged in and a user
const checkUser= (req, res, next) => {
    if (req.session.staff && req.session.staff.role === 'user') {
        console.log("User is logged in")
        return next();
    } else {
        console.log("This function is for users only.")
        req.flash('error', 'This function is for users only.');
    }
};

module.exports = {
    checkAuthentication,
    checkAdmin,
    checkUser
};